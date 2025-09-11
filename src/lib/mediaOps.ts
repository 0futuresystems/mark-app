import { db } from '../db';
import { MediaItem } from '../types';

export async function deleteMediaCompletely(mediaId: string) {
  await db.transaction('rw', db.media, db.blobs, async () => {
    await db.media.delete(mediaId);
    await db.blobs.delete(mediaId);
  });
}

export async function removePhotoFromLot(lotId: string, mediaId: string) {
  // Since we're using a separate media table, we don't need to update lot.photoIds
  // The deletion from the media table is handled by deleteMediaCompletely
  // This function is kept for compatibility but doesn't need to do anything
  return;
}

export async function updatePhotoOrder(photos: MediaItem[]): Promise<void> {
  // Update all photos with their new index values
  const updates = photos.map(photo => 
    db.media.update(photo.id, { index: photo.index })
  );
  
  await Promise.all(updates);
}
