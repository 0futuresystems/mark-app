'use client';

import { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { getMediaBlob } from '../lib/blobStore';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  mediaItem: MediaItem;
}

export default function AudioPlayer({ mediaItem }: AudioPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const loadAudio = async () => {
      try {
        const blob = await getMediaBlob(mediaItem.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
      } catch (error) {
        console.error('Error loading audio:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [mediaItem.id, audioUrl]);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
        <div className="animate-pulse bg-gray-300 rounded w-4 h-4"></div>
        <span className="text-gray-600 text-sm">Loading audio...</span>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-rose-50 rounded-lg">
        <span className="text-rose-600 text-sm">Error loading audio</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
      <button
        onClick={() => setPlaying(!playing)}
        className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <audio
        src={audioUrl}
        controls
        className="flex-1"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
