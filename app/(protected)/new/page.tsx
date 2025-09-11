'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uid } from '../../../src/lib/id';
import { nextLotNumber } from '../../../src/lib/lotNumber';
import { downscaleImage } from '@/lib/files';
import { saveMediaBlob } from '../../../src/lib/blobStore';
import { db } from '../../../src/db';
import { Lot, MediaItem } from '../../../src/types';
import CameraCapture from '../../../src/components/CameraCapture';
import AudioRecorder from '../../../src/components/AudioRecorder';
import Toast from '../../../src/components/Toast';
import { getCurrentAuction } from '../../../src/lib/currentAuction';
import { upsertLot } from '../../../src/lib/supabaseSync';
import { Camera, Mic, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function NewLotPage() {
  const router = useRouter();
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [mainVoice, setMainVoice] = useState<MediaItem | null>(null);
  const [dimensionsVoice, setDimensionsVoice] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
      console.log('Created new lot:', newLot.id, newLot.number);
      
      // Sync to Supabase
      await upsertLot({ 
        id: newLot.id, 
        auctionId: newLot.auctionId, 
        number: newLot.number, 
        status: newLot.status 
      });
      
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
      // Ensure lot exists (create if this is the first media)
      const currentLot = await ensureLotExists();
      if (!currentLot) return;

      const newPhotos: MediaItem[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const resizedFile = await downscaleImage(file);
        
        const mediaId = uid();
        const mediaItem: MediaItem = {
          id: mediaId,
          lotId: currentLot.id,
          type: 'photo',
          index: photos.length + i + 1,
          createdAt: new Date(),
          uploaded: false
        };
        
        await db.media.add(mediaItem);
        await saveMediaBlob(mediaId, resizedFile);
        console.log('Saved photo:', mediaId, 'for lot:', currentLot.id);
        
        newPhotos.push(mediaItem);
      }
      
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error('Error processing photos:', error);
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
        uploaded: false
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
        uploaded: false
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
      // Mark current lot as complete
      if (lot) {
        await db.lots.update(lot.id, { status: 'complete' });
        console.log('Marked lot as complete:', lot.id, lot.number);
        
        // Sync to Supabase
        await upsertLot({ 
          id: lot.id, 
          auctionId: lot.auctionId, 
          number: lot.number, 
          status: 'complete' 
        });
        
        // Show success toast
        setToast({ message: `Lot #${lot.number} saved`, type: 'success' });
        
        // Provide haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        
        // Wait a moment to ensure all operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Reset state for next lot (but don't create it yet)
      setLot(null);
      setPhotos([]);
      setMainVoice(null);
      setDimensionsVoice(null);
      
      // Scroll to top to show the fresh state
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      console.log('Ready for next lot - will be created when first media is added');
    } catch (error) {
      console.error('Error finishing lot:', error);
      setToast({ message: 'Failed to save lot. Please try again.', type: 'error' });
    }
  };

  // Check if we can finish the current lot
  const canFinish = photos.length >= 1;
  const currentLotNumber = lot ? lot.number : 'New';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleBack}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {lot ? `Lot #${lot.number.toString().padStart(3, '0')}` : 'New Lot'}
              </h1>
              <p className="text-gray-600 mt-1">
                {lot ? 'Complete the required steps to finish your lot' : 'Add your first photo to start'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Photos Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Photos</h2>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <CameraCapture key={`photos-${lot?.id || 'new'}`} onFiles={handlePhotos} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Captured: {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </span>
              {photos.length >= 1 ? (
                <div className="flex items-center space-x-1 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Required ✓</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-gray-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Need at least 1 photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Voice Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Main Voice Note</h2>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <AudioRecorder key={`main-voice-${lot?.id || 'new'}`} onBlob={handleMainVoice} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              {mainVoice ? (
                <div className="flex items-center space-x-1 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional ✓</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-gray-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional - not required</span>
                </div>
              )}
            </div>
          </div>

          {/* Dimensions Voice Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Dimensions Voice Note</h2>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-4">
              <AudioRecorder key={`dimensions-voice-${lot?.id || 'new'}`} onBlob={handleDimensionsVoice} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              {dimensionsVoice ? (
                <div className="flex items-center space-x-1 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional ✓</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-gray-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Optional - not required</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Finish Button */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <button
            onClick={handleFinishLot}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
              canFinish
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canFinish}
          >
            {canFinish ? (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>Finish Lot & Continue</span>
              </div>
            ) : (
              'Complete Required Steps'
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