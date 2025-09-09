'use client';

import { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { getMediaBlob } from '../lib/blobStore';

interface LotThumbnailProps {
  mediaItem: MediaItem;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function LotThumbnail({ mediaItem, size = 'medium', className = '' }: LotThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-16 h-16',
    large: 'w-40 h-40'
  };

  useEffect(() => {
    const loadImage = async () => {
      try {
        const blob = await getMediaBlob(mediaItem.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [mediaItem.id, imageUrl]);

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg flex items-center justify-center ${className}`}>
        <div className="animate-pulse bg-gray-300 rounded w-3/4 h-3/4"></div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">No image</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`Photo ${mediaItem.index}`}
      className={`${sizeClasses[size]} object-cover rounded-lg ${className}`}
    />
  );
}
