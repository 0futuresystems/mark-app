'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uid } from '../../src/lib/id';
import { nextLotNumber } from '../../src/lib/lotNumber';
import { downscaleImage } from '../../src/lib/files';
import { saveMediaBlob } from '../../src/lib/blobStore';
import { db } from '../../src/db';
import { Lot, MediaItem } from '../../src/types';
import CameraCapture from '../../src/components/CameraCapture';
import AudioRecorder from '../../src/components/AudioRecorder';
import AuctionSelector from '../../src/components/AuctionSelector';
import { Camera, Mic, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function NewLotPage() {
  const router = useRouter();
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [mainVoice, setMainVoice] = useState<MediaItem | null>(null);
  const [dimensionsVoice, setDimensionsVoice] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const createNewLot = async () => {
      if (!currentAuctionId) {
        setLoading(false);
        return;
      }
      
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
        setLoading(false);
      } catch (error) {
        console.error('Error creating lot:', error);
        setLoading(false);
      }
    };

    createNewLot();
  }, [currentAuctionId]);

  const handlePhotos = async (files: File[]) => {
    if (!lot) return;

    try {
      const newPhotos: MediaItem[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const resizedFile = await downscaleImage(file);
        
        const mediaId = uid();
        const mediaItem: MediaItem = {
          id: mediaId,
          lotId: lot.id,
          type: 'photo',
          index: photos.length + i + 1,
          createdAt: new Date(),
          uploaded: false
        };
        
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, resizedFile);
      console.log('Saved photo:', mediaId, 'for lot:', lot.id);
      
      newPhotos.push(mediaItem);
      }
      
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error('Error processing photos:', error);
    }
  };

  const handleMainVoice = async (file: File) => {
    if (!lot) return;

    try {
      // Delete existing main voice if it exists
      if (mainVoice) {
        await db.media.delete(mainVoice.id);
        await db.blobs.delete(mainVoice.id);
      }

      const mediaId = uid();
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: lot.id,
        type: 'mainVoice',
        index: 1,
        createdAt: new Date(),
        uploaded: false
      };
      
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, file);
      console.log('Saved main voice:', mediaId, 'for lot:', lot.id);
      
      setMainVoice(mediaItem);
    } catch (error) {
      console.error('Error saving main voice:', error);
    }
  };

  const handleDimensionsVoice = async (file: File) => {
    if (!lot) return;

    try {
      // Delete existing dimensions voice if it exists
      if (dimensionsVoice) {
        await db.media.delete(dimensionsVoice.id);
        await db.blobs.delete(dimensionsVoice.id);
      }

      const mediaId = uid();
      const mediaItem: MediaItem = {
        id: mediaId,
        lotId: lot.id,
        type: 'dimensionVoice',
        index: 1,
        createdAt: new Date(),
        uploaded: false
      };
      
      await db.media.add(mediaItem);
      await saveMediaBlob(mediaId, file);
      console.log('Saved dimensions voice:', mediaId, 'for lot:', lot.id);
      
      setDimensionsVoice(mediaItem);
    } catch (error) {
      console.error('Error saving dimensions voice:', error);
    }
  };

  const handleFinishLot = async () => {
    const photoCount = photos.length;
    const hasMainVoice = mainVoice !== null;
    const hasDimensionsVoice = dimensionsVoice !== null;
    
    if (photoCount < 2 || !hasMainVoice || !hasDimensionsVoice) {
      const missingItems = [];
      if (photoCount < 2) missingItems.push('at least 2 photos');
      if (!hasMainVoice) missingItems.push('main voice recording');
      if (!hasDimensionsVoice) missingItems.push('dimensions voice recording');
      
      const shouldProceed = confirm(
        `This lot is incomplete. You need ${missingItems.join(', ')}. Do you want to proceed to the next lot anyway?`
      );
      
      if (!shouldProceed) {
        return;
      }
    }
    
    // Mark current lot as complete
    if (lot) {
      await db.lots.update(lot.id, { status: 'complete' });
      console.log('Marked lot as complete:', lot.id, lot.number);
    }
    
    // Create next lot and update the current page state
    try {
      if (!currentAuctionId) {
        alert('No auction selected. Please select an auction first.');
        return;
      }
      
      const nextLotNumberValue = await nextLotNumber(currentAuctionId);
      const newLot: Lot = {
        id: uid(),
        number: nextLotNumberValue,
        auctionId: currentAuctionId,
        status: 'draft',
        createdAt: new Date()
      };
      
      await db.lots.add(newLot);
      console.log('Created new lot:', newLot.id, newLot.number);
      
      // Update the current page state to show the new lot
      setLot(newLot);
      setPhotos([]);
      setMainVoice(null);
      setDimensionsVoice(null);
      
    } catch (error) {
      console.error('Error creating next lot:', error);
      console.error('Error details:', error);
      alert('Error creating next lot. Please try again or go to review page.');
      // Don't automatically navigate to review - let user decide
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Creating new lot...</h1>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Error creating lot</h1>
          <p className="text-gray-600 mt-2">Please try again</p>
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
              onClick={() => router.back()}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">New Lot: {lot.number}</h1>
              <p className="text-gray-600 mt-1">Complete the required steps to finish your lot</p>
            </div>
          </div>
          <AuctionSelector 
            currentAuctionId={currentAuctionId}
            onAuctionChange={setCurrentAuctionId}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Photos Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Photos</h2>
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4">Take 2-5 photos of the lot</p>
            
            <div className="mb-4">
              <CameraCapture onFiles={handlePhotos} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Captured: {photos.length} photos
              </span>
              {photos.length >= 2 ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Complete</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Need {2 - photos.length} more photo{2 - photos.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Main Voice Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Main Voice Note</h2>
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4">Record a voice note describing the lot</p>
            
            <div className="mb-4">
              <AudioRecorder onBlob={handleMainVoice} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              {mainVoice ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Voice recorded</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Voice note required</span>
                </div>
              )}
            </div>
          </div>

          {/* Dimensions Voice Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Dimensions Voice Note</h2>
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4">Record a voice note describing the dimensions of the lot</p>
            
            <div className="mb-4">
              <AudioRecorder onBlob={handleDimensionsVoice} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              {dimensionsVoice ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Dimensions voice recorded</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Dimensions voice note required</span>
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
              photos.length >= 2 && mainVoice && dimensionsVoice
                ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={photos.length < 2 || !mainVoice || !dimensionsVoice}
          >
            {photos.length >= 2 && mainVoice && dimensionsVoice ? (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>Finish Lot & Continue</span>
              </div>
            ) : (
              'Complete Required Steps'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}