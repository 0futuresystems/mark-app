'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../src/db';
import { Lot, MediaItem } from '../../../src/types';
import { getCurrentAuction } from '../../../src/lib/currentAuction';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Share2, Cloud, CheckCircle, AlertCircle, X } from 'lucide-react';

// Import new utilities
import { getExportableData, createExportZip, shareZipFile, markLotsAsShared } from '../../../src/lib/exportLocal';
import { listPendingMediaByAuction, getMediaBlob } from '../../../src/lib/blobStore';
import { generateObjectKey, presignPut, presignGet, uploadBlobToR2 } from '../../../src/lib/r2';
import { updateMediaItem } from '../../../src/lib/blobStore';

export default function SendPage() {
  const router = useRouter();
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Share Now states
  const [sharing, setSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState<{current: number; total: number; label: string} | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Sync When Home states
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    label: string;
    errors?: string[];
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{success: number; failed: number; skipped: number; errors: string[]} | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

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

  const loadData = useCallback(async () => {
    if (!currentAuctionId) {
      setLots([]);
      setMedia([]);
      setLoading(false);
      return;
    }

    try {
      const [auctionLots, allMedia] = await Promise.all([
        db.lots.where('auctionId').equals(currentAuctionId).toArray(),
        db.media.toArray()
      ]);
      
      // Filter media to only include media from lots in the current auction
      const lotIds = auctionLots.map(lot => lot.id);
      const auctionMedia = allMedia.filter(m => lotIds.includes(m.lotId));
      
      setLots(auctionLots);
      setMedia(auctionMedia);
      
      // Find the most recent sync time
      const syncedLots = auctionLots.filter(lot => lot.syncedAt);
      if (syncedLots.length > 0) {
        const latestSync = syncedLots.reduce((latest, lot) => {
          const lotTime = new Date(lot.syncedAt!).getTime();
          const latestTime = new Date(latest.syncedAt!).getTime();
          return lotTime > latestTime ? lot : latest;
        });
        setLastSyncTime(latestSync.syncedAt!);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }, [currentAuctionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getUnsentLots = () => {
    return lots.filter(lot => !lot.syncedAt);
  };

  const getPendingMedia = () => {
    return media.filter(m => !m.objectKey);
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleShareNow = async () => {
    if (!currentAuctionId) return;

    setSharing(true);
    setShareProgress(null);
    setShareSuccess(false);

    try {
      // Get export data
      setShareProgress({ current: 1, total: 3, label: 'Preparing export data...' });
      const exportData = await getExportableData(currentAuctionId);

      // Create ZIP file
      setShareProgress({ current: 2, total: 3, label: 'Creating ZIP file...' });
      const zipFile = await createExportZip(exportData, (progress) => {
        setShareProgress(progress);
      });

      // Share or download
      setShareProgress({ current: 3, total: 3, label: 'Sharing file...' });
      await shareZipFile(zipFile);

      // Mark lots as shared
      const lotIds = exportData.lots.map(lot => lot.id);
      await markLotsAsShared(lotIds);

      setShareSuccess(true);
      await loadData(); // Refresh to update sharedAt timestamps
      
    } catch (error) {
      console.error('Error sharing data:', error);
      alert('Failed to share data. Please try again.');
    } finally {
      setSharing(false);
      setShareProgress(null);
    }
  };

  const handleSyncWhenHome = async () => {
    if (!currentAuctionId) return;

    setSyncing(true);
    setSyncProgress(null);
    setSyncResult(null);
    setSyncSuccess(false);

    try {
      // Step 1: Get pending media
      setSyncProgress({
        current: 0,
        total: 0,
        label: 'Finding pending media...',
        errors: []
      });

      const pendingMedia = await listPendingMediaByAuction(currentAuctionId);
      
      if (pendingMedia.length === 0) {
        setSyncSuccess(true);
        return;
      }

      setSyncProgress({
        current: 0,
        total: pendingMedia.length,
        label: `Uploading ${pendingMedia.length} media items...`,
        errors: []
      });

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Step 2: Upload each media item to R2
      for (let i = 0; i < pendingMedia.length; i++) {
        const media = pendingMedia[i];
        
        try {
          setSyncProgress({
            current: i,
            total: pendingMedia.length,
            label: `Uploading ${media.type} ${i + 1} of ${pendingMedia.length}...`,
            errors: []
          });

          // Get the blob from IndexedDB
          const blob = await getMediaBlob(media.id);
          if (!blob) {
            throw new Error(`Blob not found for media ${media.id}`);
          }

          // Generate object key
          const objectKey = generateObjectKey(media);

          // Get presigned PUT URL
          const presign = await presignPut(objectKey, media.mime);

          // Upload to R2
          const { etag } = await uploadBlobToR2(presign, blob);

          // Update media record
          await updateMediaItem(media.id, {
            objectKey,
            etag,
            uploadedAt: new Date(),
            uploaded: true
          });

          successCount++;
        } catch (error) {
          failedCount++;
          const errorMsg = `Failed to upload ${media.type} ${media.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      setSyncResult({
        success: successCount,
        failed: failedCount,
        skipped: 0,
        errors
      });

      if (failedCount > 0) {
        throw new Error(`${failedCount} media items failed to upload`);
      }

      // Step 3: Generate CSV with presigned URLs
      setSyncProgress({
        current: pendingMedia.length,
        total: pendingMedia.length,
        label: 'Generating CSV with media links...',
        errors: []
      });

      const csvRows: string[] = [];
      csvRows.push('Lot ID,Media ID,Type,Object Key,Download URL');

      for (const media of pendingMedia) {
        try {
          const presignedUrl = await presignGet(media.objectKey!, 7 * 24 * 60 * 60); // 7 days
          csvRows.push(`${media.lotId},${media.id},${media.type},${media.objectKey},${presignedUrl.url}`);
        } catch (error) {
          console.error(`Failed to generate presigned URL for ${media.id}:`, error);
          csvRows.push(`${media.lotId},${media.id},${media.type},${media.objectKey},ERROR`);
        }
      }

      const csvContent = csvRows.join('\n');

      // Step 4: Send email
      setSyncProgress({
        current: pendingMedia.length,
        total: pendingMedia.length,
        label: 'Sending email with CSV...',
        errors: []
      });

      const auction = await db.auctions.get(currentAuctionId);
      const auctionName = auction?.name || 'Unknown';

      const emailResponse = await fetch('/api/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: `Mark App Export - ${auctionName}`,
          summary: `Export from ${auctionName} with ${successCount} media items`,
          auctionId: currentAuctionId,
          csv: csvContent,
        }),
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok || emailResult?.ok !== true) {
        throw new Error(`Email failed: ${emailResult?.error || emailResponse.statusText}`);
      }

      // Step 5: Mark lots as synced
      const lotIds = lots.map(lot => lot.id);
      for (const lotId of lotIds) {
        await db.lots.update(lotId, { syncedAt: new Date().toISOString() });
      }

      setSyncSuccess(true);
      await loadData(); // Refresh to update syncedAt timestamps
      
    } catch (error) {
      console.error('Error syncing data:', error);
      setSyncResult(prev => {
        if (!prev) {
          return {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          };
        }
        return {
          ...prev,
          errors: [...prev.errors, error instanceof Error ? error.message : 'Unknown error']
        };
      });
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

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

  const unsentLots = getUnsentLots();
  const pendingMedia = getPendingMedia();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
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
              <h1 className="text-2xl sm:text-3xl font-bold text-brand-text">Send Data</h1>
              <p className="text-brand-text-muted mt-1">Share locally or sync to cloud</p>
            </div>
          </div>
        </div>
      
        {/* Status Row */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Unsent lots: <strong>{unsentLots.length}</strong>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Pending media: <strong>{pendingMedia.length}</strong>
              </span>
              {lastSyncTime && (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Last sync: <strong>{formatRelativeTime(lastSyncTime)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Success Messages */}
        {shareSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">Successfully shared ZIP file!</span>
              </div>
              <button
                onClick={() => setShareSuccess(false)}
                className="text-green-600 hover:text-green-800"
              >
                <X className="w-4 h-4" />
              </button>
              </div>
              </div>
        )}

        {syncSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">All caught up ✅</span>
              </div>
              <button
                onClick={() => setSyncSuccess(false)}
                className="text-green-600 hover:text-green-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-green-700 text-sm mt-2">
              We&apos;ve emailed your export to kvvisakh@gmail.com
            </p>
          </div>
        )}

        {/* Progress Indicators */}
        {shareProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-blue-900">Sharing Data</span>
              <span className="text-blue-700 font-medium">{Math.round((shareProgress.current / shareProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${(shareProgress.current / shareProgress.total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-blue-700">{shareProgress.label}</p>
          </div>
        )}

        {syncProgress && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-emerald-900">Syncing to Cloud</span>
              {syncProgress.total > 0 && (
                <span className="text-emerald-700 font-medium">
                  {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                </span>
              )}
            </div>
            <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300 ease-out"
                style={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '100%' }}
              />
            </div>
            <p className="mt-2 text-sm text-emerald-700">{syncProgress.label}</p>
            {syncProgress.errors && syncProgress.errors.length > 0 && (
              <div className="mt-2 text-xs text-red-600">
                <strong>Errors:</strong> {syncProgress.errors.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Main Action Cards */}
        {lots.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No lots to send yet</h3>
            <p className="text-gray-600 mb-6">Create some lots first, then come back to share or sync your data.</p>
            <a 
              href="/new" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create your first lot
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Share Now Card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-blue-600" />
            </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Share Now (ZIP for AirDrop)</h2>
                  <p className="text-gray-600 mb-6">Create a ZIP with photos + CSV from this device.</p>
              <button
                    onClick={handleShareNow}
                    disabled={sharing}
                    className={`w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg transition-all duration-200 ${
                      sharing
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'hover:bg-blue-700 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95'
                    }`}
                  >
                    {sharing ? 'Sharing...' : 'Share Now'}
              </button>
            </div>
              </div>
            </div>
            
            {/* Sync When Home Card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Sync When Home</h2>
                  <p className="text-gray-600 mb-6">Upload photos and email the CSV to the office.</p>
            <button
                    onClick={handleSyncWhenHome}
                    disabled={syncing}
                    className={`w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-lg transition-all duration-200 ${
                      syncing
                        ? 'bg-emerald-400 cursor-not-allowed'
                        : 'hover:bg-emerald-700 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95'
                    }`}
                  >
                    {syncing ? 'Syncing...' : 'Sync When Home'}
            </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {syncResult && syncResult.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-8">
            <h3 className="font-semibold text-red-900 mb-2">Sync Errors</h3>
            <div className="space-y-1">
              {syncResult.errors.map((error, index) => (
                <p key={index} className="text-sm text-red-700">{error}</p>
              ))}
              </div>
                <button
              onClick={handleSyncWhenHome}
              disabled={syncing}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Retry Sync
                </button>
          </div>
        )}
      </div>
    </div>
  );
}