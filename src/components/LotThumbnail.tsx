'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
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
  const [error, setError] = useState<string | null>(null);

  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-16 h-16',
    large: 'w-40 h-40'
  };

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const blob = await getMediaBlob(mediaItem.id);
        if (!blob) {
          setError('No blob data found');
          return;
        }
        
        // Validate blob type
        if (!blob.type.startsWith('image/')) {
          console.warn(`Invalid blob type for media item ${mediaItem.id}: ${blob.type}`);
          setError('Invalid image type');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading thumbnail:', error);
        setError(error instanceof Error ? error.message : 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    // Cleanup function to prevent memory leaks
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
    };
  }, [mediaItem.id]);

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-xs">Loading image...</span>
      </div>
    );
  }

  if (error || !imageUrl) {
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
      src={imageUrl}
      alt={`Photo ${mediaItem.index}`}
      width={size === 'small' ? 32 : size === 'medium' ? 64 : 160}
      height={size === 'small' ? 32 : size === 'medium' ? 64 : 160}
      className={`${sizeClasses[size]} object-cover rounded-lg ${className}`}
      unoptimized
    />
  );
}
