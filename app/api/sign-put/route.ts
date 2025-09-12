import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ensureAuthed } from '@/lib/ensureAuthed';
import { randomUUID } from 'crypto';
import { limit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  auctionId: z.string().min(1),
  contentType: z.enum(["image/jpeg","image/png","audio/m4a","audio/mp3"]),
});

const s3 = new S3Client({
  region: "auto",
  endpoint: env.server.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.server.R2_ACCESS_KEY_ID,
    secretAccessKey: env.server.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(req: Request) {
  try {
    const user = await ensureAuthed();
    if (!(await limit(`presign:${user.id}`, 120))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    }
    const { auctionId, contentType } = Body.parse(await req.json());
    const key = `u/${user.id}/a/${auctionId}/${randomUUID()}`;

    const cmd = new PutObjectCommand({
      Bucket: env.server.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "private",
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return Response.json({ url, key });
  } catch (error) {
    console.error('Error generating presigned PUT URL:', error);
    
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
