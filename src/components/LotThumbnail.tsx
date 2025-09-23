
'use client';

import { MediaItem } from '../types';
import { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { db } from '../db';

interface LotThumbnailProps {
  mediaItem: MediaItem;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  showOverlay?: boolean;
}

export default function LotThumbnail({ 
  mediaItem, 
  size = 'medium', 
  className = '',
  showOverlay = false 
}: LotThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    const loadAndValidateImage = async () => {
      try {
        console.log('[LotThumbnail] STARTING load for:', mediaItem.id);
        setLoading(true);
        setError(null);
        setImageLoaded(false);
        
        // Get blob data directly from IndexedDB
        const blobRecord = await db.blobs.get(mediaItem.id);
        
        console.log('[LotThumbnail] BLOB RECORD:', {
          id: mediaItem.id,
          exists: !!blobRecord,
          hasData: !!blobRecord?.data,
          dataType: blobRecord?.data ? typeof blobRecord.data : 'none',
          dataConstructor: blobRecord?.data?.constructor?.name,
          dataSize: blobRecord?.data instanceof Blob ? blobRecord.data.size : 
                   blobRecord?.data instanceof ArrayBuffer ? blobRecord.data.byteLength :
                   (blobRecord?.data as any)?.length || 'unknown'
        });
        
        if (!blobRecord?.data) {
          throw new Error('No blob data found');
        }

        // Convert data to Blob with proper MIME type
        let blob: Blob;
        const data = blobRecord.data as any;
        
        if (data instanceof Blob) {
          blob = data.type ? data : new Blob([data], { type: mediaItem.mime || 'image/jpeg' });
        } else if (data instanceof ArrayBuffer) {
          blob = new Blob([data], { type: mediaItem.mime || 'image/jpeg' });
        } else {
          throw new Error('Unsupported data format');
        }

        // CRITICAL VALIDATION: Check if blob contains valid image data
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const header = Array.from(uint8Array.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        
        const isValidImage = 
          header.startsWith('ff d8') || // JPEG
          header.startsWith('89 50 4e 47') || // PNG
          arrayBuffer.byteLength > 1000; // At least has substantial data
        
        console.log('[LotThumbnail] BLOB VALIDATION:', {
          id: mediaItem.id,
          size: blob.size,
          type: blob.type,
          headerBytes: header,
          isValidImage,
          isJPEG: header.startsWith('ff d8'),
          isPNG: header.startsWith('89 50 4e 47'),
          isEmpty: arrayBuffer.byteLength === 0
        });

        if (!isValidImage) {
          throw new Error('Invalid image data detected');
        }

        // Only create object URL if we have valid image data
        objectUrl = URL.createObjectURL(blob);
        
        console.log('[LotThumbnail] OBJECT URL CREATED:', {
          id: mediaItem.id,
          url: objectUrl,
          urlLength: objectUrl.length,
          startsWithBlob: objectUrl.startsWith('blob:')
        });
        
        if (mounted) {
          setImageUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('[LotThumbnail] FAILED to load image:', mediaItem.id, err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    loadAndValidateImage();

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mediaItem.id, mediaItem.mime]);

  const sizeConfig = {
    small: { container: 'w-12 h-12', text: 'text-xs' },
    medium: { container: 'w-20 h-20', text: 'text-sm' },
    large: { container: 'w-32 h-32', text: 'text-base' }
  };

  const config = sizeConfig[size];

  if (loading) {
    return (
      <div className={`${config.container} bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center ${className} animate-pulse`}>
        <div className="flex flex-col items-center space-y-1">
          <div className="w-4 h-4 bg-gray-400 rounded animate-pulse"></div>
          <span className={`text-gray-500 ${config.text} font-medium`}>Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`${config.container} bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center ${className} border-2 border-red-300`}>
        <div className="flex flex-col items-center space-y-1">
          <ImageIcon className="w-4 h-4 text-red-500" />
          <span className={`text-red-600 ${config.text} font-medium text-center`}>
            {error || 'Error'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${config.container} relative overflow-hidden rounded-xl ${className} group bg-gray-100`}>
      {/* Only render img if we have valid URL AND show skeleton until image actually loads */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="w-4 h-4 bg-gray-400 rounded animate-pulse"></div>
        </div>
      )}
      
      <img
        src={imageUrl}
        alt={`Photo ${mediaItem.index}`}
        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => {
          console.log('[LotThumbnail] IMAGE SUCCESSFULLY LOADED:', mediaItem.id, imageUrl);
          setImageLoaded(true);
        }}
        onError={(e) => {
          console.error('[LotThumbnail] IMAGE LOAD FAILED:', mediaItem.id, imageUrl, e);
          setError('Image load failed');
        }}
        loading="lazy"
      />
      
      {showOverlay && imageLoaded && (
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ImageIcon className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
