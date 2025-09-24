import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod4';

const signGetSchema = z.object({
  objectKey: z.string().min(1),
  expiresSeconds: z.number().optional().default(7 * 24 * 60 * 60), // 7 days default
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
    const { objectKey, expiresSeconds } = signGetSchema.parse(body);

    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: objectKey,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresSeconds });

    return NextResponse.json({
      url,
    });
  } catch (error) {
    console.error('Error generating presigned GET URL:', error);
    
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
