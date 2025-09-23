'use client';

import { MediaItem } from '../types';
import { getMediaBlob } from '../lib/blobStore';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { useState } from 'react';
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
  
  const { url, loading, error } = useObjectUrl(
    async () => {
      const blob = await getMediaBlob(mediaItem.id);
      if (!blob) {
        throw new Error('No blob data found');
      }
      
      // Ensure correct MIME type before creating object URL
      const fixedBlob = blob.type && blob.type.startsWith('image/') 
        ? blob 
        : blob.slice(0, blob.size, mediaItem.mime || 'image/jpeg');
      
      return fixedBlob;
    },
[mediaItem.id]
  );

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

  if (error || !url || imageError) {
    return (
      <div className={`${config.container} bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center ${className} border-2 border-red-300`}>
        <div className="flex flex-col items-center space-y-1">
          <ImageIcon className="w-4 h-4 text-red-500" />
          <span className={`text-red-600 ${config.text} font-medium text-center`}>
            {error === 'Invalid image type' ? 'Invalid' : 'Error'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${config.container} relative overflow-hidden rounded-xl ${className} group`}>
      <img
        src={url}
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
