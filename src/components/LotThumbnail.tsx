
'use client';

import { MediaItem } from '../types';
import { db } from '../db';
import { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';

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
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        setLoading(true);
        setImageError(false);
        
        console.log('[LotThumbnail] Loading image for:', mediaItem.id);
        
        // Get blob directly from database
        const blobRecord = await db.blobs.get(mediaItem.id);
        if (!blobRecord?.data) {
          console.error('[LotThumbnail] No blob data found for:', mediaItem.id);
          throw new Error('No blob data found');
        }

        console.log('[LotThumbnail] Blob record found:', { 
          id: mediaItem.id, 
          dataType: typeof blobRecord.data,
          isBlob: blobRecord.data instanceof Blob,
          isArrayBuffer: blobRecord.data instanceof ArrayBuffer
        });

        // Create blob with correct MIME type
        let blob: Blob;
        const data = blobRecord.data as any;
        
        if (data instanceof Blob) {
          blob = data;
        } else if (data instanceof ArrayBuffer) {
          blob = new Blob([data], { type: mediaItem.mime || 'image/jpeg' });
        } else if (data instanceof Uint8Array) {
          blob = new Blob([data], { type: mediaItem.mime || 'image/jpeg' });
        } else if (typeof data === 'string') {
          // Handle base64 strings
          try {
            const binaryString = atob(data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: mediaItem.mime || 'image/jpeg' });
          } catch (base64Error) {
            console.error('[LotThumbnail] Base64 decode failed:', base64Error);
            throw new Error('Invalid base64 data');
          }
        } else {
          console.error('[LotThumbnail] Unexpected data format:', typeof data, data);
          throw new Error('Unexpected data format');
        }

        if (blob.size === 0) {
          console.error('[LotThumbnail] Empty blob data for:', mediaItem.id);
          throw new Error('Empty blob data');
        }

        console.log('[LotThumbnail] Created blob:', { 
          size: blob.size, 
          type: blob.type 
        });

        // Create object URL
        objectUrl = URL.createObjectURL(blob);
        console.log('[LotThumbnail] Created object URL:', objectUrl);
        
        if (mounted) {
          setImageUrl(objectUrl);
          setLoading(false);
        }
      } catch (error) {
        console.error('[LotThumbnail] Error loading image:', mediaItem.id, error);
        if (mounted) {
          setImageError(true);
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
      if (objectUrl) {
        console.log('[LotThumbnail] Revoking object URL:', objectUrl);
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
  
  console.log('[LotThumbnail] Rendering state:', { 
    id: mediaItem.id,
    loading, 
    imageError, 
    hasUrl: !!imageUrl,
    url: imageUrl ? 'HAS_URL' : 'NO_URL'
  });

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

  if (imageError || !imageUrl) {
    return (
      <div className={`${config.container} bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center ${className} border-2 border-red-300`}>
        <div className="flex flex-col items-center space-y-1">
          <ImageIcon className="w-4 h-4 text-red-500" />
          <span className={`text-red-600 ${config.text} font-medium text-center`}>
            Error
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${config.container} relative overflow-hidden rounded-xl ${className} group`}>
      <img
        src={imageUrl}
        alt={`Photo ${mediaItem.index}`}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        onError={(e) => {
          console.error('[LotThumbnail] Image load error:', e, 'URL:', imageUrl);
          setImageError(true);
        }}
        onLoad={() => {
          console.log('[LotThumbnail] Image loaded successfully:', imageUrl);
        }}
        loading="lazy"
      />
      {showOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ImageIcon className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
