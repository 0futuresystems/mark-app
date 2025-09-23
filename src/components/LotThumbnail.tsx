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
        
        // Get blob directly from database
        const blobRecord = await db.blobs.get(mediaItem.id);
        if (!blobRecord?.data) {
          throw new Error('No blob data found');
        }

        // Create blob with correct MIME type
        let blob: Blob;
        const data = blobRecord.data as any;
        
        if (data instanceof Blob) {
          blob = new Blob([data], { type: mediaItem.mime || 'image/jpeg' });
        } else if (data instanceof ArrayBuffer) {
          blob = new Blob([data], { type: mediaItem.mime || 'image/jpeg' });
        } else if (typeof data === 'string') {
          // Handle base64 strings
          const binaryString = atob(data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mediaItem.mime || 'image/jpeg' });
        } else {
          throw new Error('Unexpected data format');
        }

        if (blob.size === 0) {
          throw new Error('Empty blob data');
        }

        // Create object URL
        objectUrl = URL.createObjectURL(blob);
        
        if (mounted) {
          setImageUrl(objectUrl);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading image:', mediaItem.id, error);
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
        onError={() => setImageError(true)}
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
