import { db } from '../db';
import { blobToArrayBuffer, arrayBufferToBlob } from './files';

export async function saveMediaBlob(mediaId: string, blob: Blob): Promise<void> {
  const data = await blobToArrayBuffer(blob);
  const mediaBlob = {
    id: mediaId,
    data,
    mimeType: blob.type,
    size: blob.size
  };
  
  await db.blobs.put(mediaBlob);
}

export async function getMediaBlob(mediaId: string): Promise<Blob | null> {
  const mediaBlob = await db.blobs.get(mediaId);
  if (!mediaBlob) {
    return null;
  }
  
  return arrayBufferToBlob(mediaBlob.data, mediaBlob.mimeType);
}

export async function deleteMediaBlob(mediaId: string): Promise<void> {
  await db.blobs.delete(mediaId);
}

export async function deleteMediaCompletely(mediaId: string): Promise<void> {
  await db.transaction('rw', db.media, db.blobs, async () => {
    await db.media.delete(mediaId);
    await db.blobs.delete(mediaId);
  });
}

export async function removePhotoFromLot(lotId: string, mediaId: string): Promise<void> {
  const lot = await db.lots.get(lotId);
  if (!lot) return;
  
  // Update the lot's media by removing the deleted photo
  // Since we're using a separate media table, we don't need to update lot.photoIds
  // The deletion from the media table is handled by deleteMediaCompletely
}

