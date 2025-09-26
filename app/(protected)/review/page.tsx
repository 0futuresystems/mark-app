'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../src/db';
import { Lot, MediaItem } from '../../../src/types';
import { uid } from '../../../src/lib/id';
import { saveMediaBlob, deleteMediaCompletely, getMediaBlob } from '../../../src/lib/blobStore';
import { updatePhotoOrder } from '../../../src/lib/mediaOps';
import { downscaleImage } from '@/lib/files';
import AudioRecorder from '../../../src/components/AudioRecorder';
import AudioPlayer from '../../../src/components/AudioPlayer';
import { getCurrentAuction } from '../../../src/lib/currentAuction';
import { useRouter } from 'next/navigation';
import CameraCapture from '../../../src/components/CameraCapture';
import LotThumbnail from '../../../src/components/LotThumbnail';
import LightboxCarousel from '../../../src/components/LightboxCarousel';
import PhotoGrid from '../../../src/components/PhotoGrid';
import { ArrowLeft, Trash2, Plus, CheckCircle, AlertCircle, Sparkles, Mic, Play } from 'lucide-react';
import { useToast } from '../../../src/contexts/ToastContext';
import { Dialog, DialogContent } from '../../../src/components/Dialog';

export default function ReviewPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotMedia, setLotMedia] = useState<MediaItem[]>([]);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previousDescription, setPreviousDescription] = useState('');
  const [isRewritingFromVoice, setIsRewritingFromVoice] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<{
    original: string;
    rewritten: string;
    changeSummary: string;
    transcript: string;
  } | null>(null);

  const loadLots = useCallback(async () => {
    if (!currentAuctionId) return;
    
    try {
      const allLots = await db.lots.where('auctionId').equals(currentAuctionId).toArray();
      allLots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

  // Load current auction on mount
  useEffect(() => {
    const loadCurrentAuction = async () => {
      try {
        const auction = await getCurrentAuction();
        if (!auction) {
          router.push('/auctions');
          return;
        }
        setCurrentAuctionId(auction.id);
      } catch (error) {
        console.error('Error loading current auction:', error);
        router.push('/auctions');
      }
    };

    loadCurrentAuction();
  }, [router]);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  useEffect(() => {
    if (selectedLot) {
      loadLotMedia(selectedLot.id);
      setDescription(selectedLot.description || '');
      setPreviousDescription('');
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

  const handleDescriptionChange = useCallback(async (value: string) => {
    setDescription(value);
    
    if (!selectedLot) return;
    
    try {
      await db.lots.update(selectedLot.id, { description: value });
    } catch (error) {
      console.error('Error saving description:', error);
    }
  }, [selectedLot]);

  const handleGenerateDescription = async () => {
    if (!selectedLot || isGenerating) return;
    
    const photos = allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').sort((a, b) => a.index - b.index);
    if (photos.length === 0) {
      showToast('Add at least one photo to generate a description', 'error');
      return;
    }

    setIsGenerating(true);
    setPreviousDescription(description);

    try {
      // Get up to 2 photos and convert to base64
      const selectedPhotos = photos.slice(0, 2);
      const imagePromises = selectedPhotos.map(async (photo) => {
        try {
          const blob = await getMediaBlob(photo.id);
          if (!blob) return null;
          
          // Convert blob to base64 properly
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              // Remove the data:image/...; prefix to get just the base64
              const base64Data = base64.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error processing photo:', photo.id, error);
          return null;
        }
      });

      const imageResults = await Promise.all(imagePromises);
      const images = imageResults.filter(img => img !== null);

      if (images.length === 0) {
        throw new Error('Could not process any photos');
      }

      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const newDescription = result.data.description_bullets.map((bullet: string) => `• ${bullet}`).join('\n');
        const finalDescription = `${result.data.title}\n\n${newDescription}\n\nKeywords: ${result.data.keywords}\n\n${result.data.caution}`;
        
        setDescription(finalDescription);
        await db.lots.update(selectedLot.id, { description: finalDescription });
        
        showToast('Description generated successfully!', 'success');
      } else {
        throw new Error(result.error || 'Failed to generate description');
      }
    } catch (error) {
      console.error('Error generating description:', error);
      showToast('Could not generate description. Try again or edit manually.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUndoDescription = () => {
    if (previousDescription !== '') {
      setDescription(previousDescription);
      if (selectedLot) {
        db.lots.update(selectedLot.id, { description: previousDescription });
      }
      setPreviousDescription('');
      showToast('Description restored', 'success');
    }
  };

  const handleRewriteFromVoice = async () => {
    if (!selectedLot || isRewritingFromVoice) return;

    // Find the main voice note
    const mainVoice = lotMedia.find(m => m.type === 'mainVoice');
    if (!mainVoice) {
      showToast('Main Voice Note not found', 'error');
      return;
    }

    setIsRewritingFromVoice(true);

    try {
      // Get the voice note blob
      const blob = await getMediaBlob(mainVoice.id);
      if (!blob) {
        throw new Error('Could not load voice note');
      }

      // Check if we're online for API calls
      if (!navigator.onLine) {
        // TODO: Implement offline queuing
        showToast('This feature requires an internet connection', 'error');
        return;
      }

      // Transcribe the audio
      const formData = new FormData();
      formData.append('file', blob, 'voice.webm');
      
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const transcribeResult = await transcribeResponse.json();
      const { transcript } = transcribeResult;

      if (!transcript || transcript.trim().length === 0) {
        throw new Error("Couldn't hear that clearly—try again");
      }

      // Rewrite the description
      const rewriteResponse = await fetch('/api/rewrite-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalDescription: description || '',
          transcript: transcript,
          lotMeta: {
            lotNumber: selectedLot.number,
          },
        }),
      });

      if (!rewriteResponse.ok) {
        const errorData = await rewriteResponse.json();
        throw new Error(errorData.error || 'Rewrite failed');
      }

      const rewriteResult = await rewriteResponse.json();

      // Show preview modal
      setRewritePreview({
        original: description || '',
        rewritten: rewriteResult.rewrittenDescription,
        changeSummary: rewriteResult.changeSummary,
        transcript: transcript,
      });

    } catch (error) {
      console.error('Error rewriting from voice:', error);
      showToast(error instanceof Error ? error.message : 'Failed to rewrite description', 'error');
    } finally {
      setIsRewritingFromVoice(false);
    }
  };

  const handleReplaceDescription = async () => {
    if (!rewritePreview || !selectedLot) return;

    try {
      const updatedLot = {
        description: rewritePreview.rewritten,
        descriptionSource: 'photos+voice' as const,
        voiceTranscript: rewritePreview.transcript,
        descriptionUpdatedAt: new Date().toISOString(),
      };

      await db.lots.update(selectedLot.id, updatedLot);
      setDescription(rewritePreview.rewritten);
      setPreviousDescription(rewritePreview.original);
      setRewritePreview(null);
      
      showToast('Description updated with voice note!', 'success');
    } catch (error) {
      console.error('Error updating description:', error);
      showToast('Failed to update description', 'error');
    }
  };

  const handleCancelRewrite = () => {
    setRewritePreview(null);
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
      // TODO: Replace with proper toast notification
      alert('Failed to delete lot. Please try again.');
    }
  };

  // Add photos to existing lot
  const handleAddPhotos = async (files: File[]) => {
    if (!selectedLot) return;

    try {
      const currentPhotos = allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').sort((a, b) => a.index - b.index);
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
          uploaded: false,
          mime: resizedFile.type,
          bytesSize: resizedFile.size,
          width: undefined, // Will be set by downscaleImage if available
          height: undefined // Will be set by downscaleImage if available
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
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    
    const photos = allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').sort((a, b) => a.index - b.index);
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
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    try {
      await deleteMediaCompletely(mediaId);
      loadLotMedia(selectedLot!.id);
    } catch (error) {
      console.error('Error deleting media:', error);
    }
  };

  const handlePhotoDelete = async (mediaId: string) => {
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    try {
      // Optimistically remove from local state
      setLotMedia(prev => prev.filter(m => m.id !== mediaId));
      setAllMedia(prev => prev.filter(m => m.id !== mediaId));
      
      // Delete from database
      await deleteMediaCompletely(mediaId);
      
      showToast('Photo deleted successfully', 'success');
      
      // If this was the last photo, close the lightbox
      const photos = lotMedia.filter(m => m.type === 'photo' && m.id !== mediaId);
      if (photos.length === 0) {
        setLightboxOpen(false);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      showToast('Failed to delete photo. Please try again.', 'error');
      // Revert optimistic update on error
      loadLotMedia(selectedLot!.id);
    }
  };

  const handlePhotoReorder = async (newOrder: MediaItem[]) => {
    try {
      // Optimistically update local state
      setLotMedia(prev => {
        const nonPhotos = prev.filter(m => m.type !== 'photo');
        return [...nonPhotos, ...newOrder];
      });
      
      // Update database
      await updatePhotoOrder(newOrder);
      
      showToast('Photos reordered successfully', 'success');
    } catch (error) {
      console.error('Error reordering photos:', error);
      showToast('Failed to reorder photos. Please try again.', 'error');
      // Revert optimistic update on error
      loadLotMedia(selectedLot!.id);
    }
  };

  const openLightbox = (photoIndex: number) => {
    setLightboxIndex(photoIndex);
    setLightboxOpen(true);
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
        uploaded: false,
        mime: file.type,
        bytesSize: file.size,
        duration: undefined // Could be extracted from audio metadata
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
      uploaded: false,
      mime: 'audio/webm', // Default for voice notes
      bytesSize: 0, // Will be set when file is recorded
      duration: undefined // Could be extracted from audio metadata
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
        uploaded: false,
        mime: file.type,
        bytesSize: file.size,
        duration: undefined // Could be extracted from audio metadata
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
      uploaded: false,
      mime: 'audio/webm', // Default for voice notes
      bytesSize: 0, // Will be set when file is recorded
      duration: undefined // Could be extracted from audio metadata
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
        uploaded: false,
        mime: file.type,
        bytesSize: file.size,
        duration: undefined // Could be extracted from audio metadata
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading lots...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/')}
              className="w-12 h-12 bg-brand-panel rounded-xl flex items-center justify-center hover:bg-brand-border transition-all duration-150 transform hover:scale-105 active:scale-95 shadow-soft"
            >
              <ArrowLeft className="w-6 h-6 text-brand-text" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-brand-text">Review Data</h1>
              <p className="text-brand-text-muted mt-1">Review and manage your lot entries</p>
            </div>
          </div>
        </div>
        
        {!selectedLot ? (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0">
              <h2 className="text-xl font-semibold text-gray-900">Lots ({lots.length})</h2>
              <a 
                href="/new" 
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center sm:text-left"
              >
                Create New Lot
              </a>
            </div>
            
            {lots.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No lots yet in this auction</h3>
                <p className="text-gray-600 mb-6">Get started by creating your first lot entry.</p>
                <a 
                  href="/new" 
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first lot
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {lots.map(lot => {
                  const firstPhoto = getFirstPhoto(lot.id);
                  const isComplete = isLotComplete(lot.id);
                  
                  return (
                    <div 
                      key={lot.id} 
                      className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedLot(lot)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                        <div className="flex-shrink-0 mx-auto sm:mx-0">
                          {firstPhoto ? (
                            <LotThumbnail mediaItem={firstPhoto} size="large" />
                          ) : (
                            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                              <span className="text-gray-400 text-sm">No photo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-center sm:text-left">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">Lot #{lot.number}</h3>
                          <p className="text-gray-600 text-sm mb-3">
                            Created: {lot.createdAt.toLocaleDateString()}
                          </p>
                          <div className="flex items-center justify-center sm:justify-start space-x-2">
                            {isComplete ? (
                              <div className="flex items-center space-x-1 text-emerald-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Complete</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1 text-gray-600">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setSelectedLot(null)}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Lot #{selectedLot.number}</h2>
                  <p className="text-gray-600">Created: {selectedLot.createdAt.toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => deleteLot(selectedLot.id)}
                className="px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center space-x-2 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Lot</span>
              </button>
            </div>

            {/* Photos Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Photos</h3>
                <CameraCapture onFiles={handleAddPhotos} />
              </div>
              
              <PhotoGrid
                photos={allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').sort((a, b) => a.index - b.index)}
                onReorder={handlePhotoReorder}
                onDelete={handlePhotoDelete}
                onMove={movePhoto}
                onOpenLightbox={openLightbox}
              />
            </div>

            {/* Description Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <div className="flex items-center space-x-2">
                  {previousDescription && (
                    <button
                      onClick={handleUndoDescription}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Undo
                    </button>
                  )}
                  <button
                    onClick={handleGenerateDescription}
                    disabled={isGenerating || allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').length === 0}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    title={allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').length === 0 ? "Add a photo to generate" : "Generate from Photos"}
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Analyzing photos...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate from Photos</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRewriteFromVoice}
                    disabled={isRewritingFromVoice || !lotMedia.find(m => m.type === 'mainVoice')}
                    className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    title={!lotMedia.find(m => m.type === 'mainVoice') ? "Record a main voice note first" : "Use my voice note to fix this"}
                  >
                    {isRewritingFromVoice ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Use my voice note to fix this</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <textarea
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Add a description for this lot, or use 'Generate from Photos' to create one automatically..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm font-mono leading-relaxed"
              />
              
              {description && description.includes('Attribution/age are') && (
                <p className="text-xs text-gray-500 italic mt-2">
                  Attribution/age are best estimates.
                </p>
              )}
            </div>

            {/* Main Voice Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Voice Note</h3>
              {lotMedia.find(m => m.type === 'mainVoice') ? (
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">Recorded ✓</span>
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
                    <AlertCircle className="w-4 h-4 text-gray-600" />
                    <span className="text-gray-600 font-medium">Not recorded</span>
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
                      className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
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
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-3 font-medium"
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
                      className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
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
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-3 font-medium"
                  >
                    Add Keyword Voice Note
                  </button>
                  <AudioRecorder onBlob={handleKeywordVoiceRecord} />
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Lightbox Carousel */}
        {selectedLot && (
          <LightboxCarousel
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            items={allMedia.filter(m => m.lotId === selectedLot.id && m.type === 'photo').sort((a, b) => a.index - b.index)}
            startIndex={lightboxIndex}
            onDelete={handlePhotoDelete}
          />
        )}

        {/* Rewrite Preview Modal */}
        <Dialog open={!!rewritePreview} onOpenChange={handleCancelRewrite}>
          <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Voice Note Rewrite Preview</h3>
                <button
                  onClick={handleCancelRewrite}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {rewritePreview && (
                <div className="space-y-6">
                  {/* What Changed Summary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">What changed</h4>
                    <p className="text-blue-800 text-sm whitespace-pre-line">{rewritePreview.changeSummary}</p>
                  </div>

                  {/* Play Voice Note */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Play className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Voice transcript:</span>
                    </div>
                    <p className="text-sm text-gray-600 italic">"{rewritePreview.transcript}"</p>
                  </div>

                  {/* Before and After */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Before</h4>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-64 overflow-y-auto">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {rewritePreview.original || 'No description'}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">After</h4>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 h-64 overflow-y-auto">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {rewritePreview.rewritten}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCancelRewrite}
                      className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReplaceDescription}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                    >
                      Replace Description
                    </button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
