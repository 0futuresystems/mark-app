import { MediaItem } from '../types';

/**
 * Generate a consistent object key for R2 storage
 */
export function generateObjectKey(args: {
  accountId?: string // optional
  bucket?: string    // optional, not embedded if using presign
  auctionId: string
  lotId: string
  mediaId: string
  mime: string
  index?: number
}): string {
  const ext = args.mime?.includes('jpeg') ? 'jpg' : (args.mime?.split('/')?.[1] || 'bin')
  const idx = typeof args.index === 'number' ? String(args.index).padStart(3,'0') : '000'
  return `media/${args.auctionId}/${args.lotId}/${idx}-${args.mediaId}.${ext}`
}

// Legacy function for backward compatibility
export function generateObjectKeyLegacy(media: MediaItem): string {
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
 * Simple helper to get presigned GET URL (returns just the URL string)
 */
export async function presignGetUrl(objectKey: string, expiresSeconds = 7*24*3600): Promise<string> {
  const r = await fetch('/api/sign-get', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ objectKey, expiresSeconds })
  })
  if (!r.ok) throw new Error('Failed to presign GET')
  const { url } = await r.json()
  return url as string
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
