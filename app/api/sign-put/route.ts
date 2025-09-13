import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';

const signPutSchema = z.object({
  objectKey: z.string().min(1),
  contentType: z.string().min(1),
});

const R2Schema = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // LAZY validation at request-time (not at import)
    const env = R2Schema.parse(process.env);
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    const body = await request.json();
    const { objectKey, contentType } = signPutSchema.parse(body);

    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    return NextResponse.json({
      url,
      method: 'PUT' as const,
    });
  } catch (error) {
    console.error('Error generating presigned PUT URL:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
