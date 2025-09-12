'use client'
import { ZipWriter, BlobWriter, BlobReader } from '@zip.js/zip.js'

export type ZipEntry = { path: string; blob: Blob }

export async function buildZipBundle(entries: ZipEntry[], csvText: string, onProgress?: (p:number)=>void) {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    // @zip.js can report progress per entry; pass-through here
  })
  // Add CSV first
  await writer.add('export.csv', new BlobReader(new Blob([csvText], { type: 'text/csv' })))
  // Add media
  let done = 0
  for (const e of entries) {
    await writer.add(e.path, new BlobReader(e.blob), {
      onprogress: async (bytes, total) => {
        // best-effort progress per file; convert to coarse global
        if (typeof onProgress === 'function' && total) {
          onProgress(Math.min(99, Math.floor((done + bytes / total) / entries.length * 100)))
        }
      }
    })
    done += 1
    if (typeof onProgress === 'function') onProgress(Math.min(99, Math.floor((done / entries.length) * 100)))
  }
  const zipBlob = await writer.close()
  if (typeof onProgress === 'function') onProgress(100)
  return zipBlob
}
