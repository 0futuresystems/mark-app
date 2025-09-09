'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem } from '../../src/types';
import { uid } from '../../src/lib/id';
import { saveMediaBlob, deleteMediaBlob } from '../../src/lib/blobStore';
import { downscaleImage } from '../../src/lib/files';
import AudioRecorder from '../../src/components/AudioRecorder';
import AudioPlayer from '../../src/components/AudioPlayer';
import AuctionSelector from '../../src/components/AuctionSelector';
import CameraCapture from '../../src/components/CameraCapture';
import LotThumbnail from '../../src/components/LotThumbnail';
import { ArrowLeft, Trash2, Plus, CheckCircle, AlertCircle } from 'lucide-react';

export default function ReviewPage() {
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotMedia, setLotMedia] = useState<MediaItem[]>([]);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [blobCache, setBlobCache] = useState<Map<string, string>>(new Map());

  const loadLots = useCallback(async () => {
    try {
      let allLots;
      if (currentAuctionId) {
        allLots = await db.lots.where('auctionId').equals(currentAuctionId).toArray();
        allLots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else {
        allLots = await db.lots.orderBy('createdAt').reverse().toArray();
      }
      setLots(allLots);
      
      // Load all media for the lots to compute completeness
      const lotIds = allLots.map(lot => lot.id);
      const media = await db.media.where('lotId').anyOf(lotIds).toArray();
      setAllMedia(media);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading lots:', error);
      setLoading(false);
    }
  }, [currentAuctionId]);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  useEffect(() => {
    if (selectedLot) {
      loadLotMedia(selectedLot.id);
    }
  }, [selectedLot]);

  const loadLotMedia = async (lotId: string) => {
    try {
      const media = await db.media.where('lotId').equals(lotId).toArray();
      setLotMedia(media);
    } catch (error) {
      console.error('Error loading lot media:', error);
    }
  };

  // Helper functions for completeness checking
  const getLotMedia = (lotId: string) => {
    return allMedia.filter(m => m.lotId === lotId);
  };

  const isLotComplete = (lotId: string) => {
    const media = getLotMedia(lotId);
    const photoCount = media.filter(m => m.type === 'photo').length;
    const hasMainVoice = media.some(m => m.type === 'mainVoice');
    return photoCount >= 1 && hasMainVoice;
  };

  const getFirstPhoto = (lotId: string) => {
    const media = getLotMedia(lotId);
    const photos = media.filter(m => m.type === 'photo').sort((a, b) => a.index - b.index);
    return photos.length > 0 ? photos[0] : null;
  };


  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      blobCache.forEach(url => URL.revokeObjectURL(url));
    };
  }, [blobCache]);

  // Delete lot functionality
  const deleteLot = async (lotId: string) => {
    if (!confirm('Are you sure you want to delete this lot? This will permanently remove the lot and all its media.')) {
      return;
    }

    try {
      // Delete all media items and blobs for this lot
      const mediaItems = await db.media.where('lotId').equals(lotId).toArray();
      for (const mediaItem of mediaItems) {
        await db.media.delete(mediaItem.id);
        await db.blobs.delete(mediaItem.id);
        // Clean up blob URL from cache
        if (blobCache.has(mediaItem.id)) {
          URL.revokeObjectURL(blobCache.get(mediaItem.id)!);
          setBlobCache(prev => {
            const newCache = new Map(prev);
            newCache.delete(mediaItem.id);
            return newCache;
          });
        }
      }
      
      // Delete the lot itself
      await db.lots.delete(lotId);
      
      // Update state
      setLots(prev => prev.filter(lot => lot.id !== lotId));
      setAllMedia(prev => prev.filter(media => media.lotId !== lotId));
      
      // Clear selection if this lot was selected
      if (selectedLot && selectedLot.id === lotId) {
        setSelectedLot(null);
        setLotMedia([]);
      }
      
      console.log('Deleted lot:', lotId);
    } catch (error) {
      console.error('Error deleting lot:', error);
      alert('Error deleting lot. Please try again.');
    }
  };

  // Add photos to existing lot
  const handleAddPhotos = async (files: File[]) => {
    if (!selectedLot) return;

    try {
      const currentPhotos = lotMedia.filter(m => m.type === 'photo').sort((a, b) => a.index - b.index);
      const nextIndex = currentPhotos.length > 0 ? currentPhotos[currentPhotos.length - 1].index + 1 : 1;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const resizedFile = await downscaleImage(file);
        
        const mediaId = uid();
        const mediaItem: MediaItem = {
          id: mediaId,
          lotId: selectedLot.id,
          type: 'photo',
          index: nextIndex + i,
          createdAt: new Date(),
          uploaded: false
        };
        
        await db.media.add(mediaItem);
        await saveMediaBlob(mediaId, resizedFile);
        
        // Update local state
        setLotMedia(prev => [...prev, mediaItem]);
        setAllMedia(prev => [...prev, mediaItem]);
        
        console.log('Added photo:', mediaId, 'to lot:', selectedLot.id);
      }
    } catch (error) {
      console.error('Error adding photos:', error);
    }
  };

  const movePhoto = async (mediaId: string, direction: 'up' | 'down') => {
    const photos = lotMedia.filter(m => m.type === 'photo').sort((a, b) => a.index - b.index);
    const currentIndex = photos.findIndex(p => p.id === mediaId);
    
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= photos.length) return;
    
    // Swap indices
    const currentPhoto = photos[currentIndex];
    const targetPhoto = photos[newIndex];
    
    await db.media.update(currentPhoto.id, { index: targetPhoto.index });
    await db.media.update(targetPhoto.id, { index: currentPhoto.index });
    
    loadLotMedia(selectedLot!.id);
  };

  const deleteMedia = async (mediaId: string) => {
    try {
      await db.media.delete(mediaId);
      await deleteMediaBlob(mediaId);
      loadLotMedia(selectedLot!.id);
    } catch (error) {
      console.error('Error deleting media:', error);
    }
  };

  const handleMainVoiceRecord = async (file: File) => {
    if (!selectedLot) return;

    try {
      // Delete existing main voice
      const existing = lotMedia.find(m => m.type === 'mainVoice');
      if (existing) {
        await db.media.delete(existing.id);
        await db.blobs.delete(existing.id);
      }

      // Add new main voice
      const mediaId = uid();
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: selectedLot.id,
        type: 'mainVoice',
        index: 1,
        createdAt: new Date(),
        uploaded: false
      };
      
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, file);
      
      loadLotMedia(selectedLot.id);
    } catch (error) {
      console.error('Error saving main voice:', error);
    }
  };

  const addDimensionVoice = async () => {
    if (!selectedLot) return;

    const existingDimensionVoices = lotMedia.filter(m => m.type === 'dimensionVoice');
    if (existingDimensionVoices.length >= 4) return;

    const mediaId = uid();
    const mediaItem: MediaItem = {
      id: mediaId,
      lotId: selectedLot.id,
      type: 'dimensionVoice',
      index: existingDimensionVoices.length + 1,
      createdAt: new Date(),
      uploaded: false
    };
    
    await db.media.add(mediaItem);
    loadLotMedia(selectedLot.id);
  };

  const handleDimensionVoiceRecord = async (file: File) => {
    if (!selectedLot) return;

    try {
      const mediaId = uid();
      const existingDimensionVoices = lotMedia.filter(m => m.type === 'dimensionVoice');
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: selectedLot.id,
        type: 'dimensionVoice',
        index: existingDimensionVoices.length + 1,
        createdAt: new Date(),
        uploaded: false
      };
      
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, file);
      
      loadLotMedia(selectedLot.id);
    } catch (error) {
      console.error('Error saving dimension voice:', error);
    }
  };

  const addKeywordVoice = async () => {
    if (!selectedLot) return;

    const existingKeywordVoices = lotMedia.filter(m => m.type === 'keywordVoice');
    if (existingKeywordVoices.length >= 5) return;

    const mediaId = uid();
    const mediaItem: MediaItem = {
      id: mediaId,
      lotId: selectedLot.id,
      type: 'keywordVoice',
      index: existingKeywordVoices.length + 1,
      createdAt: new Date(),
      uploaded: false
    };
    
    await db.media.add(mediaItem);
    loadLotMedia(selectedLot.id);
  };

  const handleKeywordVoiceRecord = async (file: File) => {
    if (!selectedLot) return;

    try {
      const mediaId = uid();
      const existingKeywordVoices = lotMedia.filter(m => m.type === 'keywordVoice');
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: selectedLot.id,
        type: 'keywordVoice',
        index: existingKeywordVoices.length + 1,
        createdAt: new Date(),
        uploaded: false
      };
      
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, file);
      
      loadLotMedia(selectedLot.id);
    } catch (error) {
      console.error('Error saving keyword voice:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading lots...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review Data</h1>
            <p className="text-gray-600 mt-1">Review and manage your lot entries</p>
          </div>
          <AuctionSelector 
            currentAuctionId={currentAuctionId}
            onAuctionChange={setCurrentAuctionId}
          />
        </div>
        
        {!selectedLot ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Lots ({lots.length})</h2>
              <a 
                href="/new" 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create New Lot
              </a>
            </div>
            
            {lots.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <p className="text-gray-600 mb-4">No lots found in this auction.</p>
                <a 
                  href="/new" 
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first lot
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lots.map(lot => {
                  const firstPhoto = getFirstPhoto(lot.id);
                  const isComplete = isLotComplete(lot.id);
                  
                  return (
                    <div 
                      key={lot.id} 
                      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedLot(lot)}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          {firstPhoto ? (
                            <LotThumbnail mediaItem={firstPhoto} size="large" />
                          ) : (
                            <div className="w-40 h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                              <span className="text-gray-400 text-sm">No photo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">Lot #{lot.number}</h3>
                          <p className="text-gray-600 text-sm mb-3">
                            Created: {lot.createdAt.toLocaleDateString()}
                          </p>
                          <div className="flex items-center space-x-2">
                            {isComplete ? (
                              <div className="flex items-center space-x-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Complete</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1 text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Incomplete</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Lot Detail Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setSelectedLot(null)}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Lot #{selectedLot.number}</h2>
                  <p className="text-gray-600">Created: {selectedLot.createdAt.toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => deleteLot(selectedLot.id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Lot</span>
              </button>
            </div>

            {/* Photos Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Photos</h3>
                <CameraCapture onFiles={handleAddPhotos} />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {lotMedia.filter(m => m.type === 'photo').sort((a, b) => a.index - b.index).map((photo, index) => (
                  <div key={photo.id} className="relative group">
                    <LotThumbnail mediaItem={photo} size="medium" className="w-full" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                        <button 
                          onClick={() => movePhoto(photo.id, 'up')}
                          disabled={index === 0}
                          className="p-1 bg-white rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button 
                          onClick={() => movePhoto(photo.id, 'down')}
                          disabled={index === lotMedia.filter(m => m.type === 'photo').length - 1}
                          className="p-1 bg-white rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button 
                          onClick={() => deleteMedia(photo.id)}
                          className="p-1 bg-red-500 rounded text-white hover:bg-red-600"
                          title="Delete photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="absolute top-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                      #{photo.index}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Voice Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Voice Note</h3>
              {lotMedia.find(m => m.type === 'mainVoice') ? (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">Recorded ✓</span>
                  </div>
                  <AudioPlayer mediaItem={lotMedia.find(m => m.type === 'mainVoice')!} />
                  <div className="mt-4">
                    <AudioRecorder onBlob={handleMainVoiceRecord} />
                    <p className="text-sm text-gray-600 mt-2">Re-record to replace</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 font-medium">Not recorded</span>
                  </div>
                  <AudioRecorder onBlob={handleMainVoiceRecord} />
                </div>
              )}
            </div>

            {/* Dimension Voice Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dimension Voice Notes (Optional)</h3>
              
              {lotMedia.filter(m => m.type === 'dimensionVoice').sort((a, b) => a.index - b.index).map(voice => (
                <div key={voice.id} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Note #{voice.index}</span>
                    <button 
                      onClick={() => deleteMedia(voice.id)}
                      className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      title="Delete voice note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <AudioPlayer mediaItem={voice} />
                </div>
              ))}
              
              {lotMedia.filter(m => m.type === 'dimensionVoice').length < 4 && (
                <div className="mt-4">
                  <button 
                    onClick={addDimensionVoice} 
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mb-3"
                  >
                    Add Dimension Voice Note
                  </button>
                  <AudioRecorder onBlob={handleDimensionVoiceRecord} />
                </div>
              )}
            </div>

            {/* Keyword Voice Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Keyword Voice Notes (Optional)</h3>
              
              {lotMedia.filter(m => m.type === 'keywordVoice').sort((a, b) => a.index - b.index).map(voice => (
                <div key={voice.id} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Note #{voice.index}</span>
                    <button 
                      onClick={() => deleteMedia(voice.id)}
                      className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      title="Delete voice note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <AudioPlayer mediaItem={voice} />
                </div>
              ))}
              
              {lotMedia.filter(m => m.type === 'keywordVoice').length < 5 && (
                <div className="mt-4">
                  <button 
                    onClick={addKeywordVoice} 
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mb-3"
                  >
                    Add Keyword Voice Note
                  </button>
                  <AudioRecorder onBlob={handleKeywordVoiceRecord} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
