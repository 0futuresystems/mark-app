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
  const blobRecord = await db.blobs.get(id);
  return blobRecord?.data || null;
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