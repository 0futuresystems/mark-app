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

