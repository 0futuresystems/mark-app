'use client';

import heic2any from 'heic2any';

const DEBUG_IMAGES = true; // TODO: Remove before final commit

// Cache for normalized blobs to avoid repeated conversion
const normalizedBlobCache = new Map<string, Blob>();

/**
 * Client-side blob normalization for web-friendly formats
 * Converts HEIC and other non-web formats to JPEG using browser-agnostic decoding
 */
export async function normalizeBlob(blob: Blob, mediaId: string): Promise<Blob> {
  // Check cache first
  if (normalizedBlobCache.has(mediaId)) {
    const cached = normalizedBlobCache.get(mediaId)!;
    if (DEBUG_IMAGES) {
      console.log(`[normalizeBlob] RETURNING CACHED BLOB for ${mediaId}:`, {
        size: cached.size,
        type: cached.type
      });
    }
    return cached;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const header = Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    
    const isWebFriendly = 
      header.startsWith('ff d8') || // JPEG
      header.startsWith('89 50 4e 47') || // PNG  
      header.startsWith('47 49 46 38'); // GIF
      
    const isHEIC = 
      blob.type === 'image/heic' || 
      blob.type === 'image/heif' ||
      header.includes('66 74 79 70 68 65 69 63'); // 'ftypheic' HEIC signature
    
    if (DEBUG_IMAGES) {
      console.log(`[normalizeBlob] ANALYZING BLOB for ${mediaId}:`, {
        size: blob.size,
        type: blob.type,
        headerBytes: header.substring(0, 30),
        isWebFriendly,
        isHEIC
      });
    }
    
    // Return as-is if already web-friendly
    if (isWebFriendly && !isHEIC) {
      normalizedBlobCache.set(mediaId, blob);
      return blob;
    }
    
    // Convert HEIC using heic2any
    if (isHEIC) {
      if (DEBUG_IMAGES) {
        console.log(`[normalizeBlob] CONVERTING HEIC to JPEG for ${mediaId}`);
      }
      
      try {
        const convertedBlob = await heic2any({
          blob: blob,
          toType: 'image/jpeg',
          quality: 0.9
        }) as Blob;
        
        if (DEBUG_IMAGES) {
          console.log(`[normalizeBlob] HEIC CONVERSION SUCCESS for ${mediaId}:`, {
            originalSize: blob.size,
            convertedSize: convertedBlob.size,
            originalType: blob.type,
            convertedType: convertedBlob.type
          });
        }
        
        // Cache the result
        normalizedBlobCache.set(mediaId, convertedBlob);
        return convertedBlob;
      } catch (heicError) {
        console.error(`[normalizeBlob] HEIC CONVERSION FAILED for ${mediaId}:`, heicError);
        // Fall back to createImageBitmap approach for other formats
      }
    }
    
    // Fall back to createImageBitmap + Canvas for other non-web formats
    if (!isWebFriendly) {
      if (DEBUG_IMAGES) {
        console.log(`[normalizeBlob] FALLBACK: Using createImageBitmap for ${mediaId}`);
      }
      
      try {
        const imageBitmap = await createImageBitmap(blob);
        
        // Create canvas and draw the image
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(imageBitmap, 0, 0);
        
        // Convert to JPEG blob
        const convertedBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob!);
          }, 'image/jpeg', 0.9); // 90% quality
        });
        
        if (DEBUG_IMAGES) {
          console.log(`[normalizeBlob] CANVAS CONVERSION SUCCESS for ${mediaId}:`, {
            originalSize: blob.size,
            convertedSize: convertedBlob.size,
            originalType: blob.type,
            convertedType: convertedBlob.type
          });
        }
        
        // Clean up
        imageBitmap.close();
        
        // Cache the result
        normalizedBlobCache.set(mediaId, convertedBlob);
        return convertedBlob;
      } catch (canvasError) {
        console.error(`[normalizeBlob] CANVAS CONVERSION FAILED for ${mediaId}:`, canvasError);
        // Return original blob as last resort
        return blob;
      }
    }
    
    // Cache and return original blob if no conversion needed
    normalizedBlobCache.set(mediaId, blob);
    return blob;
    
  } catch (error) {
    console.error(`[normalizeBlob] BLOB ANALYSIS FAILED for ${mediaId}:`, error);
    return blob; // Return original on any error
  }
}

/**
 * Clear the normalization cache (useful for testing or memory management)
 */
export function clearNormalizationCache(): void {
  normalizedBlobCache.clear();
  if (DEBUG_IMAGES) {
    console.log('[normalizeBlob] CACHE CLEARED');
  }
}

/**
 * Get cache statistics for debugging
 */
export function getNormalizationCacheStats(): { size: number; entries: string[] } {
  return {
    size: normalizedBlobCache.size,
    entries: Array.from(normalizedBlobCache.keys())
  };
}