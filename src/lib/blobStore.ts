import { db } from '../db';
import { MediaItem } from '../types';

/**
 * Save a media blob to IndexedDB
 */
export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  await db.blobs.put({
    id,
    data: blob
  });
}

/**
 * Get a media blob from IndexedDB
 */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  try {
    const [blobRecord, mediaRecord] = await Promise.all([
      db.blobs.get(id),
      db.media.get(id)
    ]);
    
    if (!blobRecord) {
      console.warn(`No blob record found for ID: ${id}`);
      return null;
    }
    if (!blobRecord.data) {
      console.warn(`Blob record exists but data is null for ID: ${id}`);
      return null;
    }
    
    // Get the correct MIME type from the media record
    const correctMimeType = mediaRecord?.mime || 'image/jpeg';
    
    // Ensure we return a proper Blob object with correct MIME type
    const data = blobRecord.data as any;
    if (data instanceof Blob && typeof data.arrayBuffer === 'function') {
      // Fix blob type if it's missing or incorrect
      if (!data.type || !data.type.startsWith('image/')) {
        return data.slice(0, data.size, correctMimeType);
      }
      return data;
    } else if (data instanceof ArrayBuffer) {
      return new Blob([data], { type: correctMimeType });
    } else if (typeof data === 'string') {
      // Handle base64 strings
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: correctMimeType });
    } else {
      console.error(`Unexpected blob data type for ID: ${id}`, typeof data, data);
      return null;
    }
  } catch (error) {
    console.error(`Error retrieving blob for ID: ${id}`, error);
    return null;
  }
}

/**
 * Delete a media blob from IndexedDB
 */
export async function deleteMediaBlob(id: string): Promise<void> {
  await db.blobs.delete(id);
}

/**
 * List pending media (not uploaded to cloud) for a specific auction
 */
export async function listPendingMediaByAuction(auctionId: string): Promise<MediaItem[]> {
  // Get all lots for this auction
  const lots = await db.lots.where('auctionId').equals(auctionId).toArray();
  const lotIds = lots.map(lot => lot.id);
  
  // Get all media for these lots that haven't been uploaded to cloud storage
  const media = await db.media
    .where('lotId')
    .anyOf(lotIds)
    .and(item => !item.objectKey) // Only items without objectKey (not uploaded)
    .toArray();
  
  return media;
}

/**
 * Get all media for a specific lot
 */
export async function getMediaByLot(lotId: string): Promise<MediaItem[]> {
  return await db.media
    .where('lotId')
    .equals(lotId)
    .sortBy('index');
}

/**
 * Delete media and its associated blob
 */
export async function deleteMediaItem(mediaId: string): Promise<void> {
  await db.transaction('rw', [db.media, db.blobs], async () => {
    await db.media.delete(mediaId);
    await db.blobs.delete(mediaId);
  });
}

/**
 * Delete media completely (alias for deleteMediaItem for backward compatibility)
 */
export async function deleteMediaCompletely(mediaId: string): Promise<void> {
  return deleteMediaItem(mediaId);
}

/**
 * Update media item metadata
 */
export async function updateMediaItem(mediaId: string, updates: Partial<MediaItem>): Promise<void> {
  await db.media.update(mediaId, updates);
}

/**
 * Diagnostic function to check for media/blob inconsistencies
 */
export async function diagnoseMediaBlobs(): Promise<{
  totalMedia: number;
  totalBlobs: number;
  orphanedMedia: string[];
  orphanedBlobs: string[];
  missingBlobs: string[];
}> {
  const allMedia = await db.media.toArray();
  const allBlobs = await db.blobs.toArray();
  
  const mediaIds = new Set(allMedia.map(m => m.id));
  const blobIds = new Set(allBlobs.map(b => b.id));
  
  const orphanedMedia = allMedia.filter(m => !blobIds.has(m.id)).map(m => m.id);
  const orphanedBlobs = allBlobs.filter(b => !mediaIds.has(b.id)).map(b => b.id);
  const missingBlobs = allMedia.filter(m => !blobIds.has(m.id)).map(m => m.id);
  
  console.log('Media/Blob Diagnostic:', {
    totalMedia: allMedia.length,
    totalBlobs: allBlobs.length,
    orphanedMedia: orphanedMedia.length,
    orphanedBlobs: orphanedBlobs.length,
    missingBlobs: missingBlobs.length
  });
  
  if (orphanedMedia.length > 0) {
    console.warn('Orphaned media items (no corresponding blob):', orphanedMedia);
  }
  
  if (orphanedBlobs.length > 0) {
    console.warn('Orphaned blobs (no corresponding media):', orphanedBlobs);
  }
  
  return {
    totalMedia: allMedia.length,
    totalBlobs: allBlobs.length,
    orphanedMedia,
    orphanedBlobs,
    missingBlobs
  };
}

/**
 * Clean up orphaned blobs (blobs without corresponding media items)
 */
export async function cleanupOrphanedBlobs(): Promise<number> {
  const { orphanedBlobs } = await diagnoseMediaBlobs();
  
  if (orphanedBlobs.length > 0) {
    await db.transaction('rw', [db.blobs], async () => {
      for (const blobId of orphanedBlobs) {
        await db.blobs.delete(blobId);
      }
    });
    console.log(`Cleaned up ${orphanedBlobs.length} orphaned blobs`);
  }
  
  return orphanedBlobs.length;
}

/**
 * Test database connectivity and basic operations
 */
export async function testDatabaseConnectivity(): Promise<{
  success: boolean;
  error?: string;
  mediaCount: number;
  blobCount: number;
}> {
  try {
    // Test basic database access
    const mediaCount = await db.media.count();
    const blobCount = await db.blobs.count();
    
    console.log(`Database connectivity test: ${mediaCount} media items, ${blobCount} blobs`);
    
    return {
      success: true,
      mediaCount,
      blobCount
    };
  } catch (error) {
    console.error('Database connectivity test failed:', error);
    return {
      success: false,
      error: String(error),
      mediaCount: 0,
      blobCount: 0
    };
  }
}