'use client';

import { MediaItem } from '../types';
import { getMediaBlob } from '../lib/blobStore';
import { useObjectUrl } from '../hooks/useObjectUrl';

interface AudioPlayerProps {
  mediaItem: MediaItem;
}

export default function AudioPlayer({ mediaItem }: AudioPlayerProps) {
  const { url, loading } = useObjectUrl(
    () => getMediaBlob(mediaItem.id),
    [mediaItem.id]
  );

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
        <div className="animate-pulse bg-gray-300 rounded w-4 h-4"></div>
        <span className="text-gray-600 text-sm">Loading audio...</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-rose-50 rounded-lg">
        <span className="text-rose-600 text-sm">Error loading audio</span>
      </div>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={url ?? undefined}
      className="w-full"
    />
  );
}
