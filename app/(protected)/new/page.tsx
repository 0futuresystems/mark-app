'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uid } from '../../../src/lib/id';
import { nextLotNumber } from '../../../src/lib/lotNumber';
import { downscaleImage } from '@/lib/files';
import { saveMediaBlob, getMediaBlob } from '../../../src/lib/blobStore';
import { db } from '../../../src/db';
import { Lot, MediaItem } from '../../../src/types';
import CameraCapture from '../../../src/components/CameraCapture';
import AudioRecorder from '../../../src/components/AudioRecorder';
import Toast from '../../../src/components/Toast';
import { getCurrentAuction } from '../../../src/lib/currentAuction';
// Removed Supabase sync import - keeping /new page fully offline
import { Camera, Mic, CheckCircle, AlertCircle, ArrowLeft, FileText, Sparkles } from 'lucide-react';

export default function NewLotPage() {
  const router = useRouter();
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [mainVoice, setMainVoice] = useState<MediaItem | null>(null);
  const [dimensionsVoice, setDimensionsVoice] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // Removed uploadingPhotos state - not needed for offline-first approach
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [finishingLot, setFinishingLot] = useState(false);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previousDescription, setPreviousDescription] = useState('');

  // Debounced save function for description
  const saveDescription = async (text: string) => {
    if (!lot) return;
    try {
      await db.lots.update(lot.id, { description: text });
      console.log('Saved description for lot:', lot.id);
    } catch (error) {
      console.error('Error saving description:', error);
    }
  };

  // Debounced description handler
  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    // Debounce the save operation
    setTimeout(() => {
      saveDescription(text);
    }, 500);
  };

  // Cleanup function to delete incomplete lot and its media
  const cleanupIncompleteLot = async (lotToCleanup: Lot) => {
    try {
      // Delete all media items for this lot
      const mediaItems = await db.media.where('lotId').equals(lotToCleanup.id).toArray();
      for (const mediaItem of mediaItems) {
        await db.media.delete(mediaItem.id);
        await db.blobs.delete(mediaItem.id);
      }
      
      // Delete the lot itself
      await db.lots.delete(lotToCleanup.id);
      console.log('Cleaned up incomplete lot:', lotToCleanup.id);
    } catch (error) {
      console.error('Error cleaning up incomplete lot:', error);
    }
  };

  // Create lot only when first media is added
  const ensureLotExists = async () => {
    if (lot || !currentAuctionId) return lot;
    
    try {
      const lotNumber = await nextLotNumber(currentAuctionId);
      const newLot: Lot = {
        id: uid(),
        number: lotNumber,
        auctionId: currentAuctionId,
        status: 'draft',
        createdAt: new Date()
      };
      
      await db.lots.add(newLot);
      setLot(newLot);
      // Hydrate description from lot data
      setDescription(newLot.description ?? '');
      console.log('Created new lot:', newLot.id, newLot.number);
      
      // No network sync - keeping /new page fully offline
      
      return newLot;
    } catch (error) {
      console.error('Error creating lot:', error);
      return null;
    }
  };

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
      } finally {
        setLoading(false);
      }
    };

    loadCurrentAuction();
  }, [router]);

  // Handle page exit/back with cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (lot && photos.length === 0) {
        cleanupIncompleteLot(lot);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [lot, photos.length]);

  const handleBack = async () => {
    if (lot && photos.length === 0) {
      await cleanupIncompleteLot(lot);
    }
    router.back();
  };

  const handlePhotos = async (files: File[]) => {
    if (!currentAuctionId) return;

    try {
      setUploadProgress({ current: 0, total: files.length, label: 'Saving locally...' });
      
      // Ensure lot exists (create if this is the first media)
      const currentLot = await ensureLotExists();
      if (!currentLot) return;

      const newPhotos: MediaItem[] = [];
      
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ 
          current: i + 1, 
          total: files.length, 
          label: `Saving photo ${i + 1} of ${files.length} locally...` 
        });
        
        const file = files[i];
        const resizedFile = await downscaleImage(file);
        
        const mediaId = uid();
        const mediaItem: MediaItem = {
          id: mediaId,
          lotId: currentLot.id,
          type: 'photo',
          index: photos.length + i + 1,
          createdAt: new Date(),
          uploaded: false,
          mime: resizedFile.type,
          bytesSize: resizedFile.size,
          width: undefined, // Will be set by downscaleImage if available
          height: undefined // Will be set by downscaleImage if available
        };
        
        await db.media.add(mediaItem);
        await saveMediaBlob(mediaId, resizedFile);
        console.log('Saved photo:', mediaId, 'for lot:', currentLot.id);
        
        newPhotos.push(mediaItem);
      }
      
      setPhotos(prev => [...prev, ...newPhotos]);
      setToast({ message: `Captured: ${files.length} photos`, type: 'success' });
    } catch (error) {
      console.error('Error processing photos:', error);
      setToast({ message: 'Failed to process photos. Please try again.', type: 'error' });
    } finally {
      setUploadProgress(null);
    }
  };

  const handleMainVoice = async (file: File) => {
    if (!currentAuctionId) return;

    try {
      // Ensure lot exists (create if this is the first media)
      const currentLot = await ensureLotExists();
      if (!currentLot) return;

      // Delete existing main voice if it exists
      if (mainVoice) {
        await db.media.delete(mainVoice.id);
        await db.blobs.delete(mainVoice.id);
      }

      const mediaId = uid();
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: currentLot.id,
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
      console.log('Saved main voice:', mediaId, 'for lot:', currentLot.id);
      
      setMainVoice(mediaItem);
    } catch (error) {
      console.error('Error saving main voice:', error);
    }
  };

  const handleDimensionsVoice = async (file: File) => {
    if (!currentAuctionId) return;

    try {
      // Ensure lot exists (create if this is the first media)
      const currentLot = await ensureLotExists();
      if (!currentLot) return;

      // Delete existing dimensions voice if it exists
      if (dimensionsVoice) {
        await db.media.delete(dimensionsVoice.id);
        await db.blobs.delete(dimensionsVoice.id);
      }

      const mediaId = uid();
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: currentLot.id,
        type: 'dimensionVoice',
        index: 1,
        createdAt: new Date(),
        uploaded: false,
        mime: file.type,
        bytesSize: file.size,
        duration: undefined // Could be extracted from audio metadata
      };
      
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, file);
      console.log('Saved dimensions voice:', mediaId, 'for lot:', currentLot.id);
      
      setDimensionsVoice(mediaItem);
    } catch (error) {
      console.error('Error saving dimensions voice:', error);
    }
  };

  const handleFinishLot = async () => {
    const photoCount = photos.length;
    
    // Enforce minimum requirements: at least 1 photo
    if (photoCount < 1) {
      alert('Cannot finish lot. You need at least 1 photo.');
      return;
    }
    
    try {
      setFinishingLot(true);
      setUploadProgress({ current: 0, total: 3, label: 'Finishing lot...' });
      
      // Mark current lot as complete
      if (lot) {
        setUploadProgress({ current: 1, total: 3, label: 'Saving lot data...' });
        await db.lots.update(lot.id, { status: 'complete', description });
        console.log('Marked lot as complete:', lot.id, lot.number);
        
        setUploadProgress({ current: 2, total: 3, label: 'Saving locally...' });
        // No network sync - keeping /new page fully offline
        
        setUploadProgress({ current: 3, total: 3, label: 'Complete!' });
        
        // Show success toast
        setToast({ message: `Lot #${lot.number} saved`, type: 'success' });
        
        // Provide haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        
        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Reset state for next lot (but don't create it yet)
      setLot(null);
      setPhotos([]);
      setMainVoice(null);
      setDimensionsVoice(null);
      setDescription('');
      
      // Scroll to top to show the fresh state
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      console.log('Ready for next lot - will be created when first media is added');
    } catch (error) {
      console.error('Error finishing lot:', error);
      setToast({ message: 'Failed to save lot. Please try again.', type: 'error' });
    } finally {
      setFinishingLot(false);
      setUploadProgress(null);
    }
  };

  // Check if we can finish the current lot
  const canFinish = photos.length >= 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-brand-text">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleBack}
              className="w-12 h-12 bg-brand-panel rounded-xl flex items-center justify-center hover:bg-brand-border transition-all duration-150 transform hover:scale-105 active:scale-95 shadow-soft"
            >
              <ArrowLeft className="w-6 h-6 text-brand-text" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-brand-text">
                {lot ? `Lot #${lot.number.toString().padStart(3, '0')}` : 'New Lot'}
              </h1>
              <p className="text-brand-text-muted mt-1">
                {lot ? 'Complete the required steps to finish your lot' : 'Add your first photo to start'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Upload Progress Indicator */}
        {uploadProgress && (
          <div className="mb-6 bg-brand-panel border border-brand-border rounded-2xl p-4 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-accent border-t-transparent"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-text">{uploadProgress.label}</p>
                <div className="mt-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-brand-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm text-brand-text-muted">
                {uploadProgress.current}/{uploadProgress.total}
              </span>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Photos Section */}
          <div className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-brand-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-text">Photos</h2>
              <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <CameraCapture key={`photos-${lot?.id || 'new'}`} onFiles={handlePhotos} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-text-muted">
                Captured: <span className={photos.length > 0 ? 'text-brand-success font-semibold' : 'text-brand-error font-semibold'}>{photos.length}</span>
              </span>
              {photos.length >= 1 ? (
                <div className="flex items-center space-x-1 text-brand-success">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Required ✓</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-brand-text-muted">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Need at least 1 photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-brand-border lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-text">Description</h2>
              <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <textarea
                value={description}
                onChange={(e) => {
                  if (!lot) {
                    // Ensure lot exists on first input
                    ensureLotExists();
                  }
                  handleDescriptionChange(e.target.value);
                }}
                placeholder="Enter lot description, condition notes, or other details..."
                className="w-full h-32 px-4 py-3 bg-white border border-brand-border rounded-xl text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none"
                disabled={!lot}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-text-muted">
                Characters: <span className="font-semibold">{description.length}</span>
              </span>
              <div className="flex items-center space-x-1 text-brand-text-muted">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Optional</span>
              </div>
            </div>
          </div>

          {/* Main Voice Section */}
          <div className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-brand-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-text">Main Voice Note</h2>
              <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <AudioRecorder key={`main-voice-${lot?.id || 'new'}`} onBlob={handleMainVoice} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-text-muted">Status</span>
              {mainVoice ? (
                <div className="flex items-center space-x-1 text-brand-success">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional ✓</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-brand-text-muted">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional</span>
                </div>
              )}
            </div>
          </div>

          {/* Dimensions Voice Section */}
          <div className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-brand-border lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-text">Dimensions Voice Note</h2>
              <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <AudioRecorder key={`dimensions-voice-${lot?.id || 'new'}`} onBlob={handleDimensionsVoice} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-text-muted">Status</span>
              {dimensionsVoice ? (
                <div className="flex items-center space-x-1 text-brand-success">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional ✓</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-brand-text-muted">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Finish Button */}
        <div className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-brand-border">
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(50);
              handleFinishLot();
            }}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 ${
              canFinish && !finishingLot
                ? 'bg-brand-accent text-white hover:bg-brand-accent-hover shadow-soft hover:shadow-medium'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canFinish || finishingLot}
          >
            {finishingLot ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                <span>Finishing...</span>
              </div>
            ) : canFinish ? (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>Finish Lot & Continue</span>
              </div>
            ) : (
              'Complete Steps'
            )}
          </button>
        </div>
        
        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}