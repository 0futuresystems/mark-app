import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { ensureAuthed } from '@/lib/ensureAuthed';
import { limit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  auctionId: z.string().min(1),
  objectKey: z.string().min(3),
  contentType: z.string().min(3),
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
    const { auctionId, objectKey, contentType } = Body.parse(await req.json());

    // Sanity check: ensure prefix belongs to user & auction
    if (!objectKey.startsWith(`u/${user.id}/a/${auctionId}/`)) {
      return NextResponse.json({ error: 'bad key scope' }, { status: 400 });
    }

    // 1) HEAD preflight
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }));
      const etag = head.ETag?.replace(/"/g, '') ?? 'existing';
      return NextResponse.json({ exists: true, key: objectKey, etag });
    } catch (e: any) {
      // Not found (continue), any other error should be surfaced
      if (e?.$metadata?.httpStatusCode && e.$metadata.httpStatusCode !== 404) {
        return NextResponse.json({ error: 'HEAD failed' }, { status: e.$metadata.httpStatusCode });
      }
    }

    // 2) Presign guarded PUT (If-None-Match:* prevents accidental overwrite)
    const cmd = new PutObjectCommand({
        Bucket: env.R2_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      // @ts-ignore - IfNoneMatch is supported in S3 semantics
      IfNoneMatch: '*',
      ACL: 'private'
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return NextResponse.json({ exists: false, key: objectKey, url });
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
