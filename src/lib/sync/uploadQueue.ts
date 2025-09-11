import { db } from '../../db';
import { MediaItem } from '../../types';
import { getMediaBlob } from '../blobStore';
import { uploadToR2, UploadResult } from './r2Client';
// Use Web Crypto API instead of Node.js crypto

export interface UploadProgress {
  current: number;
  total: number;
  label: string;
  errors: string[];
}

export interface UploadQueueResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// Content-addressed key generation using Web Crypto API
export async function generateObjectKey(blob: Blob, mediaItem: MediaItem): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Get file extension from blob type
  let extension = '';
  if (mediaItem.type === 'photo') {
    extension = blob.type.includes('jpeg') || blob.type.includes('jpg') ? '.jpg' : 
               blob.type.includes('png') ? '.png' : '.jpg';
  } else if (mediaItem.type === 'mainVoice' || mediaItem.type === 'dimensionVoice' || mediaItem.type === 'keywordVoice') {
    extension = blob.type.includes('webm') ? '.webm' : 
               blob.type.includes('mp3') ? '.mp3' : '.webm';
  }
  
  return `media/${contentHash}${extension}`;
}

export async function getPendingMedia(auctionId: string): Promise<MediaItem[]> {
  const [lots, allMedia] = await Promise.all([
    db.lots.where('auctionId').equals(auctionId).toArray(),
    db.media.toArray()
  ]);

  const lotIds = lots.map(lot => lot.id);
  const auctionMedia = allMedia.filter(m => lotIds.includes(m.lotId));
  
  // Return media that doesn't have an objectKey (not yet uploaded)
  return auctionMedia.filter(m => !m.objectKey);
}

export async function uploadMediaWithRetry(
  mediaItem: MediaItem,
  maxRetries: number = 3
): Promise<UploadResult | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const blob = await getMediaBlob(mediaItem.id);
      if (!blob) {
        throw new Error(`Media blob not found for ${mediaItem.id}`);
      }

      const objectKey = await generateObjectKey(blob, mediaItem);
      const result = await uploadToR2(objectKey, blob, blob.type);
      
      if (result) {
        // Update media item with objectKey and etag
        await db.media.update(mediaItem.id, {
          objectKey: result.objectKey,
          etag: result.etag
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Upload attempt ${attempt} failed for ${mediaItem.id}:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export async function uploadBatch(
  mediaItems: MediaItem[],
  onProgress?: (progress: UploadProgress) => void,
  concurrency: number = 3
): Promise<UploadQueueResult> {
  const result: UploadQueueResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  let current = 0;
  const total = mediaItems.length;

  // Process in batches with controlled concurrency
  for (let i = 0; i < mediaItems.length; i += concurrency) {
    const batch = mediaItems.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (mediaItem) => {
      try {
        // Check if already uploaded (skip if has objectKey)
        if (mediaItem.objectKey) {
          result.skipped++;
          return;
        }

        await uploadMediaWithRetry(mediaItem);
        result.success++;
      } catch (error) {
        result.failed++;
        const errorMsg = `Failed to upload ${mediaItem.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
      } finally {
        current++;
        onProgress?.({
          current,
          total,
          label: `Uploading media... (${current}/${total})`,
          errors: result.errors
        });
      }
    });

    await Promise.all(batchPromises);
  }

  return result;
}

export async function uploadPendingMedia(
  auctionId: string,
  onProgress?: (progress: UploadProgress) => void,
  concurrency: number = 3
): Promise<UploadQueueResult> {
  const pendingMedia = await getPendingMedia(auctionId);
  
  if (pendingMedia.length === 0) {
    onProgress?.({
      current: 0,
      total: 0,
      label: 'No pending media to upload',
      errors: []
    });
    
    return {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  onProgress?.({
    current: 0,
    total: pendingMedia.length,
    label: `Found ${pendingMedia.length} media items to upload`,
    errors: []
  });

  return uploadBatch(pendingMedia, onProgress, concurrency);
}
