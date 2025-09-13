// src/lib/media/getMediaBlob.ts
// Normalize any media shape -> Blob (for zipping/email attachments).
export type AnyMedia =
  | Blob
  | File
  | ArrayBuffer
  | { blob?: Blob | File; dataUrl?: string; url?: string; path?: string; buffer?: ArrayBuffer; type?: string }
  | string // data:, blob:, http(s) or OPFS-like "media/..."
  ;

async function readOPFSFile(path: string): Promise<Blob> {
  // path like "media/uuid_1.jpg"
  const root: any = await (navigator as any).storage?.getDirectory?.();
  if (!root) throw new Error('OPFS not available');
  const parts = path.split('/').filter(Boolean);
  let dir = root;
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
  const fh = await dir.getFileHandle(parts.at(-1)!);
  return fh.getFile();
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
    // OPFS-ish relative path
    return await readOPFSFile(input);
  }

  // Wrapped object shapes
  if (typeof input === 'object') {
    const obj = input as any;
    if (obj.blob instanceof Blob) return obj.blob;
    if (obj.dataUrl) return (await fetch(obj.dataUrl)).blob();
    if (obj.url) {
      if (typeof obj.url === 'string') return (await fetch(obj.url)).blob();
      if (obj.url instanceof URL) return (await fetch(obj.url)).blob();
    }
    if (obj.path && typeof obj.path === 'string') return await readOPFSFile(obj.path);
    if (obj.buffer instanceof ArrayBuffer) return new Blob([obj.buffer], obj.type ? { type: obj.type } : {});
  }

  throw new Error('unsupported media object (pass blob/file/url/dataUrl)');
}
