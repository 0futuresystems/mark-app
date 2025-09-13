// src/lib/toArrayBuffer.ts
import { getMediaBlob } from './media/getMediaBlob';

export async function toArrayBuffer(input: unknown): Promise<ArrayBuffer> {
  // Keep old fast-paths, but normalize everything else to Blob
  if (!input) throw new Error('empty media');

  // If it already is ArrayBuffer
  if (input instanceof ArrayBuffer) return input;

  // If it is a Blob/File or a supported shape, normalize to Blob then .arrayBuffer()
  try {
    const blob = await getMediaBlob(input as any);
    return await blob.arrayBuffer();
  } catch (e) {
    // Helpful diagnostics in dev only
    if (process.env.NODE_ENV !== 'production') {
      console.warn('toArrayBuffer unsupported shape:', {
        type: typeof input,
        ctor: (input as any)?.constructor?.name,
        keys: typeof input === 'object' && input ? Object.keys(input as any) : undefined,
        err: String(e),
      });
    }
    throw new Error('unsupported media object (pass blob/file/url/dataUrl)');
  }
}
