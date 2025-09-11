'use client';

import Image from 'next/image';
import { MediaItem } from '../types';
import { getMediaBlob } from '../lib/blobStore';
import { useObjectUrl } from '../hooks/useObjectUrl';

interface LotThumbnailProps {
  mediaItem: MediaItem;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function LotThumbnail({ mediaItem, size = 'medium', className = '' }: LotThumbnailProps) {
  const { url, loading, error } = useObjectUrl(
    async () => {
      const blob = await getMediaBlob(mediaItem.id);
      if (!blob) {
        throw new Error('No blob data found');
      }
      
      // Validate blob type
      if (!blob.type.startsWith('image/')) {
        console.warn(`Invalid blob type for media item ${mediaItem.id}: ${blob.type}`);
        throw new Error('Invalid image type');
      }
      
      return blob;
    },
    [mediaItem.id]
  );

  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-16 h-16',
    large: 'w-40 h-40'
  };

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-xs">Loading image...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">
          {error === 'Invalid image type' ? 'Invalid image' : 'No image'}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={`Photo ${mediaItem.index}`}
      width={size === 'small' ? 32 : size === 'medium' ? 64 : 160}
      height={size === 'small' ? 32 : size === 'medium' ? 64 : 160}
      className={`${sizeClasses[size]} object-cover rounded-lg ${className}`}
      unoptimized
    />
  );
}
