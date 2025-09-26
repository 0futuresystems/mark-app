'use client'
import { ZipWriter, BlobWriter, BlobReader } from '@zip.js/zip.js'
import { getMediaBlob } from './media/getMediaBlob'

export type ZipEntry = { path: string; media?: any; text?: string }

export type ZipResult = {
  blob: Blob;
  errors: Array<{ id: string; reason: string }>;
}

// Helper function to generate unique paths in ZIP
function uniquePath(basePath: string, used: Set<string>) {
  let p = basePath;
  let i = 1;
  const dot = basePath.lastIndexOf('.');
  while (used.has(p)) {
    p = dot > 0
      ? `${basePath.slice(0, dot)}-${i++}${basePath.slice(dot)}`
      : `${basePath}-${i++}`;
  }
  used.add(p);
  return p;
}

export async function buildZipBundle(entries: ZipEntry[], onProgress?: (p:number)=>void): Promise<ZipResult> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    // @zip.js can report progress per entry; pass-through here
  })
  const errors: Array<{ id: string; reason: string }> = []
  const used = new Set<string>()
  let done = 0
  const total = entries.length

  // Add all entries (media files and text files)
  for (const e of entries) {
    try {
      // Generate unique path to avoid duplicates
      const uniqueZipPath = uniquePath(e.path, used)
      
      if (e.text !== undefined) {
        // Add text file
        await writer.add(uniqueZipPath, new BlobReader(new Blob([e.text], { type: 'text/plain;charset=utf-8' })))
      } else if (e.media) {
        // Add media file - resolve to Blob via getMediaBlob
        const blob = await getMediaBlob(e.media)
        
        await writer.add(uniqueZipPath, new BlobReader(blob), {
          onprogress: async (bytes, total) => {
            // best-effort progress per file; convert to coarse global
            if (typeof onProgress === 'function' && total) {
              onProgress(Math.min(99, Math.floor((done + bytes / total) / total * 100)))
            }
          }
        })
      } else {
        throw new Error('Entry must have either media or text property')
      }
    } catch (error: any) {
      // Collect error but continue processing
      const id = e.path.split('/').pop() || 'unknown'
      errors.push({ 
        id, 
        reason: error?.message ?? String(error) 
      })
      console.warn(`Skipped file ${e.path}:`, error)
    } finally {
      done += 1
      if (typeof onProgress === 'function') onProgress(Math.round((done / total) * 100))
    }
  }
  
  const zipBlob = await writer.close()
  if (typeof onProgress === 'function') onProgress(100)
  
  return { blob: zipBlob, errors }
}
