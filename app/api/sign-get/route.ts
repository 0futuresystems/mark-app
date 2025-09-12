import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { ensureAuthed } from '@/lib/ensureAuthed';
import { limit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  objectKey: z.string().min(1),
  auctionId: z.string().min(1),
  expiresSeconds: z.number().optional().default(3600), // 1 hour default
});

const R2Schema = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    // LAZY validation at request-time (not at import)
    const env = R2Schema.parse(process.env);
    
    const s3 = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true
    });
    
    const user = await ensureAuthed();
    if (!(await limit(`presign:${user.id}`, 120))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    }
    
    const { objectKey, auctionId, expiresSeconds } = Body.parse(await req.json());
    
    // Only allow access to keys under the user's prefix and specific auction
    const expectedPrefix = `u/${user.id}/a/${auctionId}/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cmd = new GetObjectCommand({
        Bucket: env.R2_BUCKET,
      Key: objectKey,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
    return Response.json({ url });
  } catch (error) {
    console.error('Error generating presigned GET URL:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    if ((error as any)?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
