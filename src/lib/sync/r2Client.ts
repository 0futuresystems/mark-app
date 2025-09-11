import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerEnv } from '../env';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface UploadResult {
  objectKey: string;
  etag: string;
  size: number;
  mime: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
}

let r2Client: S3Client | null = null;
let r2Config: R2Config | null = null;

export function getR2Config(): R2Config | null {
  if (r2Config) return r2Config;

  try {
    const env = getServerEnv(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']);
    
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      console.warn('R2 configuration incomplete');
      return null;
    }

    r2Config = {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME || 'lot-media',
      publicUrl: env.R2_PUBLIC_URL || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/lot-media`
    };

    return r2Config;
  } catch (error) {
    console.error('Failed to get R2 config:', error);
    return null;
  }
}

export function getR2Client(): S3Client | null {
  if (r2Client) return r2Client;

  const config = getR2Config();
  if (!config) return null;

  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    return r2Client;
  } catch (error) {
    console.error('Failed to create R2 client:', error);
    return null;
  }
}

export async function uploadToR2(
  objectKey: string,
  blob: Blob,
  contentType: string
): Promise<UploadResult | null> {
  const client = getR2Client();
  const config = getR2Config();
  
  if (!client || !config) {
    throw new Error('R2 client not configured');
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: blob,
      ContentType: contentType,
      ContentLength: blob.size,
    });

    const result = await client.send(command);
    
    return {
      objectKey,
      etag: result.ETag || '',
      size: blob.size,
      mime: contentType
    };
  } catch (error) {
    console.error(`Failed to upload ${objectKey}:`, error);
    throw error;
  }
}

export async function generatePresignedUrl(
  objectKey: string,
  expiresIn: number = 14 * 24 * 60 * 60 // 14 days
): Promise<PresignedUrlResult | null> {
  const client = getR2Client();
  const config = getR2Config();
  
  if (!client || !config) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    
    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    };
  } catch (error) {
    console.error(`Failed to generate presigned URL for ${objectKey}:`, error);
    return null;
  }
}

export function getPublicUrl(objectKey: string): string {
  const config = getR2Config();
  if (!config) return '';
  
  return `${config.publicUrl}/${objectKey}`;
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}
