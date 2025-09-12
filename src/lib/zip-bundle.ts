'use client'
import { ZipWriter, BlobWriter, BlobReader } from '@zip.js/zip.js'
import { toArrayBuffer } from './toArrayBuffer'

export type ZipEntry = { path: string; blob: Blob }

export type ZipResult = {
  blob: Blob;
  errors: Array<{ id: string; reason: string }>;
}

export async function buildZipBundle(entries: ZipEntry[], csvText: string, onProgress?: (p:number)=>void): Promise<ZipResult> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    // @zip.js can report progress per entry; pass-through here
  })
  const errors: Array<{ id: string; reason: string }> = []
  let done = 0
  const total = entries.length + 1 // +1 for CSV

  // Add CSV first
  await writer.add('export.csv', new BlobReader(new Blob([csvText], { type: 'text/csv' })))
  done += 1
  if (typeof onProgress === 'function') onProgress(Math.round((done / total) * 100))

  // Add media with fault tolerance
  for (const e of entries) {
    try {
      // Normalize the blob to ArrayBuffer using our helper
      const arrayBuffer = await toArrayBuffer(e.blob)
      const normalizedBlob = new Blob([arrayBuffer], { type: e.blob.type || 'application/octet-stream' })
      
      await writer.add(e.path, new BlobReader(normalizedBlob), {
        onprogress: async (bytes, total) => {
          // best-effort progress per file; convert to coarse global
          if (typeof onProgress === 'function' && total) {
            onProgress(Math.min(99, Math.floor((done + bytes / total) / total * 100)))
          }
        }
      })
    } catch (error: any) {
      // Collect error but continue processing
      const id = e.path.split('/').pop() || 'unknown'
      errors.push({ 
        id, 
        reason: error?.message ?? String(error) 
      })
      console.warn(`Skipped media file ${e.path}:`, error)
    } finally {
      done += 1
      if (typeof onProgress === 'function') onProgress(Math.round((done / total) * 100))
    }
  }
  
  const zipBlob = await writer.close()
  if (typeof onProgress === 'function') onProgress(100)
  
  return { blob: zipBlob, errors }
}
