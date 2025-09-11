import { db } from '../db';
import { getMediaBlob } from './blobStore';
import { upsertMedia } from './supabaseSync';
import { queueSyncOperation } from './sync/worker';
import { useSyncStore } from './sync/state';

export interface UploadProgress {
  done: number;
  total: number;
  label?: string;
}

export interface UploadResult {
  success: number;
  failed: number;
  skipped: number;
  total: number;
  errors: string[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract media metadata
async function extractMediaMetadata(blob: Blob, mediaType: string): Promise<{
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
}> {
  const metadata: {
    bytes: number;
    width?: number;
    height?: number;
    duration?: number;
  } = {
    bytes: blob.size
  };

  if (mediaType === 'photo') {
    try {
      // Extract image dimensions
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          metadata.width = img.naturalWidth;
          metadata.height = img.naturalHeight;
          URL.revokeObjectURL(url);
          resolve(undefined);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        img.src = url;
      });
    } catch (error) {
      console.warn('Failed to extract image dimensions:', error);
    }
  } else if (mediaType.includes('Voice')) {
    try {
      // Extract audio duration
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        audio.onloadedmetadata = () => {
          metadata.duration = audio.duration;
          URL.revokeObjectURL(url);
          resolve(undefined);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load audio'));
        };
        audio.src = url;
      });
    } catch (error) {
      console.warn('Failed to extract audio duration:', error);
    }
  }

  return metadata;
}

export async function syncPending(
  onProgress?: (info: UploadProgress) => void
): Promise<UploadResult> {
  const result: UploadResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    errors: []
  };

  try {
    // Check if offline
    if (navigator.onLine === false) {
      result.skipped = 1;
      result.errors.push('Device is offline');
      return result;
    }

    // Find all media items that haven't been uploaded
    const pendingMedia = await db.media.filter(media => !media.uploaded).toArray();
    result.total = pendingMedia.length;
    
    if (pendingMedia.length === 0) {
      return result;
    }

    onProgress?.({ done: 0, total: pendingMedia.length, label: 'Starting upload...' });
    
    for (let i = 0; i < pendingMedia.length; i++) {
      const media = pendingMedia[i];
      
      try {
        onProgress?.({ 
          done: i, 
          total: pendingMedia.length, 
          label: `Uploading ${media.type} ${media.index}...` 
        });

        // Get the lot to access lot number
        const lot = await db.lots.get(media.lotId);
        if (!lot) {
          result.failed++;
          result.errors.push(`Lot not found for media ${media.id}`);
          continue;
        }
        
        // Get the blob data
        const blob = await getMediaBlob(media.id);
        if (!blob) {
          result.failed++;
          result.errors.push(`Blob not found for media ${media.id}`);
          continue;
        }
        
        // Create the key for the remote storage
        const key = `Lot-${lot.number}/${media.type}/${media.id}`;
        
        // Try to upload with retries
        let uploadSuccess = false;
        let lastError = '';
        
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            // Request presigned URL from API
            const signResponse = await fetch('/api/sign', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                key,
                contentType: blob.type
              })
            });
            
            if (!signResponse.ok) {
              throw new Error(`Failed to get presigned URL: ${signResponse.statusText}`);
            }
            
            const { url } = await signResponse.json();
            
            // Check if it's a stub URL
            if (url.startsWith('data:') || url.includes('stub')) {
              console.log(`Simulating upload for ${media.id} (stub URL)`);
              
              // Extract media metadata even for stub uploads
              const metadata = await extractMediaMetadata(blob, media.type);
              
              // Mark as uploaded for testing
              await db.media.update(media.id, { 
                uploaded: true, 
                remotePath: key,
                bytes: metadata.bytes,
                width: metadata.width,
                height: metadata.height,
                duration: metadata.duration,
                needsSync: true // Mark for Supabase sync
              });
              
              // Queue for Supabase sync (non-blocking)
              const kind = media.type === 'photo' ? 'photo' : 'audio';
              queueSyncOperation(`media-${media.id}`, async () => {
                await upsertMedia({
                  id: media.id,
                  lotId: media.lotId,
                  kind,
                  r2Key: key,
                  bytes: metadata.bytes,
                  width: metadata.width,
                  height: metadata.height,
                  duration: metadata.duration,
                  indexInLot: media.index
                });
                
                // Mark as synced
                await db.media.update(media.id, { needsSync: false });
              });
              
              uploadSuccess = true;
              result.success++;
              break;
            }
            
            // Upload the blob to the presigned URL
            const uploadResponse = await fetch(url, {
              method: 'PUT',
              body: blob,
              headers: {
                'Content-Type': blob.type
              }
            });
            
            if (uploadResponse.ok) {
              // Extract media metadata
              const metadata = await extractMediaMetadata(blob, media.type);
              
              // Mark as uploaded and store remote path and metadata
              await db.media.update(media.id, { 
                uploaded: true, 
                remotePath: key,
                bytes: metadata.bytes,
                width: metadata.width,
                height: metadata.height,
                duration: metadata.duration,
                needsSync: true // Mark for Supabase sync
              });
              
              // Queue for Supabase sync (non-blocking)
              const kind = media.type === 'photo' ? 'photo' : 'audio';
              queueSyncOperation(`media-${media.id}`, async () => {
                await upsertMedia({
                  id: media.id,
                  lotId: media.lotId,
                  kind,
                  r2Key: key,
                  bytes: metadata.bytes,
                  width: metadata.width,
                  height: metadata.height,
                  duration: metadata.duration,
                  indexInLot: media.index
                });
                
                // Mark as synced
                await db.media.update(media.id, { needsSync: false });
              });
              
              uploadSuccess = true;
              result.success++;
              console.log(`Successfully uploaded ${media.id}`);
              break;
            } else {
              throw new Error(`Upload failed: ${uploadResponse.statusText}`);
            }
            
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Upload attempt ${attempt} failed for ${media.id}:`, error);
            
            if (attempt < 2) {
              // Wait before retry
              await delay(500);
            }
          }
        }
        
        if (!uploadSuccess) {
          result.failed++;
          result.errors.push(`Failed to upload ${media.id}: ${lastError}`);
        }
        
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error processing media ${media.id}: ${errorMsg}`);
        console.error(`Error processing media ${media.id}:`, error);
      }
    }
    
    onProgress?.({ 
      done: pendingMedia.length, 
      total: pendingMedia.length, 
      label: 'Upload complete' 
    });
    
  } catch (error) {
    console.error('Error in syncPending:', error);
    result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return result;
}

