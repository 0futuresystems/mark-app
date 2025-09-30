'use client';

import { useState, useEffect } from 'react';
import { db } from '../../src/db';
import { MediaItem } from '../../src/types';
import LotThumbnail from '../../src/components/LotThumbnail';
import { getMediaBlob } from '../../src/lib/blobStore';

export default function TestThumbnailsPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTestMedia = async () => {
      try {
        const allMedia = await db.media.where('type').equals('photo').toArray();
        console.log('Test thumbnails: found', allMedia.length, 'photos');
        setMediaItems(allMedia.slice(0, 6)); // Show first 6 for testing
        setLoading(false);
      } catch (error) {
        console.error('Error loading test media:', error);
        setLoading(false);
      }
    };

    loadTestMedia();
  }, []);

  const testNormalization = async (mediaId: string) => {
    try {
      console.log('Testing normalization for:', mediaId);
      const blob = await getMediaBlob(mediaId);
      console.log('Normalized blob result:', {
        exists: !!blob,
        size: blob?.size,
        type: blob?.type
      });
    } catch (error) {
      console.error('Normalization test failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading test data...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Thumbnail Test</h1>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>First, go to <a href="/test-setup" className="text-blue-600 underline">/test-setup</a> and create test data</li>
            <li>Check thumbnails below - they should show actual images, not black squares</li>
            <li>Open browser DevTools Console to see normalization logs</li>
            <li>Click "Test Normalization" buttons to verify blob conversion</li>
            <li>Then test <a href="/review" className="text-blue-600 underline">/review</a> page</li>
          </ol>
        </div>

        {mediaItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No test data found</h3>
            <p className="text-gray-600 mb-4">Please create test data first</p>
            <a 
              href="/test-setup" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Test Data
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Test Thumbnails ({mediaItems.length} items)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {mediaItems.map((item, index) => (
                <div key={item.id} className="text-center">
                  <LotThumbnail mediaItem={item} size="large" />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600">ID: {item.id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-600">Type: {item.mime}</p>
                    <p className="text-xs text-gray-600">Size: {item.bytesSize} bytes</p>
                    <button
                      onClick={() => testNormalization(item.id)}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      Test Normalization
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
