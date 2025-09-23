
// src/lib/media/getMediaBlob.ts
// Normalize any media shape -> Blob (for zipping/email attachments).
import { db } from '../../db';

export type AnyMedia =
  | Blob
  | File
  | ArrayBuffer
  | { blob?: Blob | File; dataUrl?: string; url?: string; path?: string; buffer?: ArrayBuffer; type?: string; id?: string }
  | string // data:, blob:, http(s) or media ID
  ;

async function readMediaFromIndexedDB(mediaId: string): Promise<Blob> {
  console.log('[getMediaBlob] Reading from IndexedDB:', mediaId);
  
  const blobRecord = await db.blobs.get(mediaId);
  if (!blobRecord?.data) {
    // Check if media item exists but blob is missing
    const mediaItem = await db.media.get(mediaId);
    if (mediaItem) {
      console.error(`[getMediaBlob] Media item exists but blob is missing for ID: ${mediaId}`, {
        mediaItem: {
          id: mediaItem.id,
          lotId: mediaItem.lotId,
          type: mediaItem.type,
          uploaded: mediaItem.uploaded,
          createdAt: mediaItem.createdAt
        }
      });
      throw new Error(`Media blob not found for ID: ${mediaId} (media item exists but blob missing)`);
    } else {
      console.error(`[getMediaBlob] Media item not found for ID: ${mediaId}`);
      throw new Error(`Media item not found for ID: ${mediaId}`);
    }
  }
  
  console.log('[getMediaBlob] Found blob record:', {
    id: mediaId,
    dataType: typeof blobRecord.data,
    isBlob: blobRecord.data instanceof Blob,
    isArrayBuffer: blobRecord.data instanceof ArrayBuffer,
    isUint8Array: blobRecord.data instanceof Uint8Array
  });
  
  // Ensure we return a proper Blob object with arrayBuffer() method
  const data = blobRecord.data as any;
  if (data instanceof Blob) {
    console.log('[getMediaBlob] Returning existing Blob:', data.size, 'bytes');
    return data;
  } else if (data instanceof ArrayBuffer) {
    console.log('[getMediaBlob] Converting ArrayBuffer to Blob:', data.byteLength, 'bytes');
    return new Blob([data]);
  } else if (data instanceof Uint8Array) {
    console.log('[getMediaBlob] Converting Uint8Array to Blob:', data.length, 'bytes');
    return new Blob([data]);
  } else if (typeof data === 'string') {
    console.log('[getMediaBlob] Converting base64 string to Blob');
    try {
      // Handle base64 strings
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      console.log('[getMediaBlob] Converted base64 to Blob:', blob.size, 'bytes');
      return blob;
    } catch (base64Error) {
      console.error('[getMediaBlob] Base64 decode failed:', base64Error);
      throw new Error(`Invalid base64 data for ID: ${mediaId}`);
    }
  } else {
    console.error(`[getMediaBlob] Unexpected blob data type for ID: ${mediaId}`, typeof data, data);
    throw new Error(`Invalid blob data type for ID: ${mediaId}`);
  }
}

export async function getMediaBlob(input: AnyMedia): Promise<Blob> {
  if (!input) throw new Error('empty media');

  // Direct Blob/File
  if (input instanceof Blob) return input;
  if (input instanceof File) return input;

  // ArrayBuffer
  if (input instanceof ArrayBuffer) return new Blob([input]);

  // String inputs
  if (typeof input === 'string') {
    if (input.startsWith('data:') || input.startsWith('blob:')) {
      return (await fetch(input)).blob();
    }
    if (input.startsWith('http')) {
      // Only allow if CORS-allowed or same-origin.
      return (await fetch(input)).blob();
    }
    // Assume it's a media ID and try to read from IndexedDB
    return await readMediaFromIndexedDB(input);
  }

  // Wrapped object shapes (including MediaItem)
  if (typeof input === 'object') {
    const obj = input as any;
    if (obj.blob instanceof Blob) return obj.blob;
    if (obj.dataUrl) return (await fetch(obj.dataUrl)).blob();
    if (obj.url) {
      if (typeof obj.url === 'string') return (await fetch(obj.url)).blob();
      if (obj.url instanceof URL) return (await fetch(obj.url)).blob();
    }
    if (obj.buffer instanceof ArrayBuffer) return new Blob([obj.buffer], obj.type ? { type: obj.type } : {});
    
    // If it has an ID, try to read from IndexedDB (MediaItem case)
    if (obj.id && typeof obj.id === 'string') {
      return await readMediaFromIndexedDB(obj.id);
    }
  }

  throw new Error('unsupported media object (pass blob/file/url/dataUrl/mediaId)');
}
