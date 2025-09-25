export interface ProcessImageOptions {
  maxLongEdge?: number;  // Target long edge size (default: 2560px)
  quality?: number;      // JPEG quality 0-1 (default: 0.95)
  skipIfAlreadyProcessed?: boolean; // Skip if already meets criteria (default: true)
  handleEXIF?: boolean;  // Handle EXIF orientation correction (default: true)
}

export async function processImage(
  file: File, 
  options: ProcessImageOptions = {}
): Promise<File> {
  const {
    maxLongEdge = 2560,
    quality = 0.95,
    skipIfAlreadyProcessed = true,
    handleEXIF = true
  } = options;


  return new Promise(async (resolve, reject) => {
    try {
      // Get EXIF orientation if handling EXIF is enabled
      const orientation = handleEXIF ? await readEXIFOrientation(file) : 1;
      
      const img = new Image();
      
      img.onload = () => {
        const { width, height } = img;
        const longEdge = Math.max(width, height);
        
        // Skip re-processing if already meets criteria and no EXIF correction needed
        if (skipIfAlreadyProcessed && file.type === 'image/jpeg' && longEdge <= maxLongEdge && orientation === 1) {
          resolve(file);
          return;
        }

        // Calculate target dimensions preserving aspect ratio
        const ratio = Math.min(maxLongEdge / width, maxLongEdge / height, 1); // Don't upscale
        let targetWidth = Math.round(width * ratio);
        let targetHeight = Math.round(height * ratio);

        // Create canvas with proper dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Apply EXIF orientation transformations and set canvas size
        switch (orientation) {
          case 2: // flip horizontal
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.transform(-1, 0, 0, 1, targetWidth, 0);
            break;
          case 3: // 180 rotate
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.transform(-1, 0, 0, -1, targetWidth, targetHeight);
            break;
          case 4: // flip vertical
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.transform(1, 0, 0, -1, 0, targetHeight);
            break;
          case 5: // flip vertical + 90 rotate right
            canvas.width = targetHeight;
            canvas.height = targetWidth;
            ctx.transform(0, 1, 1, 0, 0, 0);
            break;
          case 6: // 90 rotate right
            canvas.width = targetHeight;
            canvas.height = targetWidth;
            ctx.transform(0, 1, -1, 0, targetHeight, 0);
            break;
          case 7: // flip horizontal + 90 rotate right
            canvas.width = targetHeight;
            canvas.height = targetWidth;
            ctx.transform(0, -1, -1, 0, targetHeight, targetWidth);
            break;
          case 8: // 90 rotate left
            canvas.width = targetHeight;
            canvas.height = targetWidth;
            ctx.transform(0, -1, 1, 0, 0, targetWidth);
            break;
          default: // normal orientation
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            break;
        }
        
        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image with scaling and orientation correction in single pass
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(processedFile);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    } catch (error) {
      reject(error);
    }
  });

// Read EXIF orientation from JPEG file
async function readEXIFOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const view = new DataView(buffer);
      
      try {
        // Check JPEG markers
        if (view.getUint16(0) !== 0xFFD8) {
          resolve(1); // Not a JPEG, assume normal orientation
          return;
        }
        
        let offset = 2;
        let marker: number;
        let little = false;
        
        // Find EXIF marker (0xFFE1)
        while (offset < view.byteLength) {
          marker = view.getUint16(offset);
          if (marker === 0xFFE1) {
            offset += 4; // Skip marker and length
            // Check for "Exif\0\0"
            if (view.getUint32(offset) === 0x45786966 && view.getUint16(offset + 4) === 0x0000) {
              offset += 6;
              break;
            }
          }
          if ((marker & 0xFF00) !== 0xFF00) break;
          offset += 2 + view.getUint16(offset + 2);
        }
        
        if (offset >= view.byteLength) {
          resolve(1); // No EXIF found
          return;
        }
        
        // Check TIFF header for endianness
        const tiffHeaderOffset = offset;
        if (view.getUint16(offset) === 0x4949) {
          little = true;
        } else if (view.getUint16(offset) === 0x4D4D) {
          little = false;
        } else {
          resolve(1); // Invalid TIFF header
          return;
        }
        
        // Skip TIFF header (2 bytes endian + 2 bytes magic) and get first IFD offset
        offset += 4;
        const firstIfdRelativeOffset = little ? view.getUint32(offset, true) : view.getUint32(offset);
        const ifdOffset = tiffHeaderOffset + firstIfdRelativeOffset;
        
        // Read IFD entries
        const entries = little ? view.getUint16(ifdOffset, true) : view.getUint16(ifdOffset);
        
        for (let i = 0; i < entries; i++) {
          const entryOffset = ifdOffset + 2 + (i * 12);
          const tag = little ? view.getUint16(entryOffset, true) : view.getUint16(entryOffset);
          
          if (tag === 0x0112) { // Orientation tag
            const orientation = little ? view.getUint16(entryOffset + 8, true) : view.getUint16(entryOffset + 8);
            resolve(orientation);
            return;
          }
        }
        
        resolve(1); // Orientation tag not found, assume normal
      } catch (error) {
        resolve(1); // Default to normal orientation
      }
    };
    
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // Read first 64KB for EXIF
  });
}
}

// Legacy function for backward compatibility - now uses processImage
export async function downscaleImage(
  file: File, 
  maxW: number = 1600, 
  quality: number = 0.82
): Promise<File> {
  return processImage(file, { 
    maxLongEdge: maxW, 
    quality,
    skipIfAlreadyProcessed: false // Legacy behavior - always process
  });
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export function arrayBufferToBlob(buf: ArrayBuffer, mimeType: string): Blob {
  return new Blob([buf], { type: mimeType });
}

