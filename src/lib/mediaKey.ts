// src/lib/mediaKey.ts
export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function extFor(mime?: string) {
  if (!mime) return '';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('m4a')) return '.m4a';
  if (mime.includes('mp3')) return '.mp3';
  if (mime.includes('wav')) return '.wav';
  return '';
}

/** Build deterministic key: same content => same key */
export async function objectKeyFor(blob: Blob, userId: string, auctionId: string, lotId: string | undefined, mime?: string) {
  const hex = await sha256Hex(blob);
  const ext = extFor(mime ?? blob.type);
  const lotPart = lotId ? `l/${lotId}/` : '';
  return `u/${userId}/a/${auctionId}/${lotPart}${hex}${ext}`;
}
