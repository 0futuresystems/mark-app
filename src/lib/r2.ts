import { MediaItem } from '../types';

/**
 * Generate a consistent object key for R2 storage
 */
export function generateObjectKey(media: MediaItem): string {
  // Get auction ID from the lot
  // Format: ${auctionId}/${lotId}/${media.id}.${extension}
  const extension = media.mime.split('/')[1] || 'jpg';
  return `media/${media.lotId}/${media.id}.${extension}`;
}

/**
 * Presign a PUT request for uploading to R2
 */
export async function presignPut(objectKey: string, contentType: string): Promise<{
  url: string;
  method: 'PUT';
  headers?: Record<string, string>;
}> {
  const response = await fetch('/api/sign-put', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      objectKey,
      contentType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get presigned PUT URL: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Presign a GET request for downloading from R2
 */
export async function presignGet(objectKey: string, expiresSeconds: number = 7 * 24 * 60 * 60): Promise<{
  url: string;
}> {
  const response = await fetch('/api/sign-get', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      objectKey,
      expiresSeconds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get presigned GET URL: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Upload a blob to R2 using a presigned URL
 */
export async function uploadBlobToR2(
  presign: { url: string; method: 'PUT'; headers?: Record<string, string> },
  blob: Blob
): Promise<{ etag: string }> {
  const response = await fetch(presign.url, {
    method: presign.method,
    headers: {
      'Content-Type': blob.type,
      ...presign.headers,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to R2: ${response.statusText}`);
  }

  const etag = response.headers.get('etag');
  return { etag: etag || '' };
}
