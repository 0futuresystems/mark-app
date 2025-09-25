export interface ProcessImageOptions {
  maxLongEdge?: number;  // Target long edge size (default: 2560px)
  quality?: number;      // JPEG quality 0-1 (default: 0.95)
  skipIfAlreadyProcessed?: boolean; // Skip if already meets criteria (default: true)
}

export async function processImage(
  file: File, 
  options: ProcessImageOptions = {}
): Promise<File> {
  const {
    maxLongEdge = 2560,
    quality = 0.95,
    skipIfAlreadyProcessed = true
  } = options;

  // Console log for debugging (remove after verification)
  console.log('[processImage] Processing:', file.name, 'size:', file.size, 'type:', file.type);

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const { width, height } = img;
      const longEdge = Math.max(width, height);
      
      // Skip re-processing if already meets criteria
      if (skipIfAlreadyProcessed && file.type === 'image/jpeg' && longEdge <= maxLongEdge) {
        console.log('[processImage] Skipping - already meets criteria:', longEdge, '<=', maxLongEdge);
        resolve(file);
        return;
      }

      // Calculate target dimensions preserving aspect ratio
      const ratio = Math.min(maxLongEdge / width, maxLongEdge / height, 1); // Don't upscale
      const targetWidth = Math.round(width * ratio);
      const targetHeight = Math.round(height * ratio);

      // Create canvas with proper dimensions
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Set canvas size to target resolution (not CSS scaling)
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Enable high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw and process
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const processedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            console.log('[processImage] Processed:', targetWidth + 'x' + targetHeight, 'quality:', quality, 'size:', processedFile.size);
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
  });
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

