'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../src/db';
import { Lot, MediaItem } from '../../../src/types';
import { getCurrentAuction } from '../../../src/lib/currentAuction';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Share2, Cloud, CheckCircle, AlertCircle, X, Download, Copy, Mail, ExternalLink } from 'lucide-react';

// Import new utilities
import { getExportableData, createExportZip, shareZipFile, markLotsAsShared } from '../../../src/lib/exportLocal';
import { listPendingMediaByAuction } from '../../../src/lib/blobStore';
import { getMediaBlob } from '../../../src/lib/media/getMediaBlob';
import { generateObjectKey, presignPut, presignGet, presignGetUrl, uploadBlobToR2 } from '../../../src/lib/r2';
import { updateMediaItem } from '../../../src/lib/blobStore';
import { downloadTextFile, copyToClipboard, buildCsvFromLots } from '../../../src/lib/client-utils';
import { buildZipBundle } from '../../../src/lib/zip-bundle';
import { uploadZipToR2, presignZipGet } from '../../../src/lib/export-upload';

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
  
  // New states for delivery confirmation and fallbacks
  const [lastEmail, setLastEmail] = useState<{id: string | null; at: string; count: number} | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [links, setLinks] = useState<string[]>([]);
  const [showToast, setShowToast] = useState<string | null>(null);
  
  // ZIP export states
  const [zipProgress, setZipProgress] = useState<number>(0);
  const [zipDownloadUrl, setZipDownloadUrl] = useState<string>('');
  const [syncErrors, setSyncErrors] = useState<Array<{ id: string; reason: string }>>([]);

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

  const showToastMessage = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 3000);
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
    setSyncError(null);
    setLastEmail(null);
    setCsvText('');
    setLinks([]);
    setZipProgress(0);
    setZipDownloadUrl('');

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
      const uploadErrors: string[] = [];

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
          const objectKey = generateObjectKey({ 
            auctionId: currentAuctionId, 
            lotId: media.lotId, 
            mediaId: media.id, 
            mime: media.mime, 
            index: media.index 
          });

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
          uploadErrors.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      setSyncResult({
        success: successCount,
        failed: failedCount,
        skipped: 0,
        errors: uploadErrors
      });

      if (failedCount > 0) {
        throw new Error(`${failedCount} media items failed to upload`);
      }

      // Step 3: Re-query Dexie for updated media records and generate CSV with presigned URLs
      setSyncProgress({
        current: pendingMedia.length,
        total: pendingMedia.length,
        label: 'Generating CSV with media links...',
        errors: []
      });

      // Re-query Dexie to get updated media records with objectKey
      const uploadedMedia = await db.media
        .where('lotId')
        .anyOf(lots.map(lot => lot.id))
        .and(media => media.objectKey != null)
        .toArray();

      const csvRows: string[] = [];
      csvRows.push('Lot ID,Media ID,Type,Object Key,Download URL');
      const generatedLinks: string[] = [];

      for (const media of uploadedMedia) {
        try {
          const presignedUrl = await presignGetUrl(media.objectKey!, 7 * 24 * 60 * 60); // 7 days
          csvRows.push(`${media.lotId},${media.id},${media.type},${media.objectKey},${presignedUrl}`);
          generatedLinks.push(presignedUrl);
        } catch (error) {
          console.error(`Failed to generate presigned URL for ${media.id}:`, error);
          csvRows.push(`${media.lotId},${media.id},${media.type},${media.objectKey},ERROR`);
        }
      }

      const csvContent = csvRows.join('\n');
      setCsvText(csvContent);
      setLinks(generatedLinks);

      // Step 4: Create and upload ZIP
      setSyncProgress({
        current: pendingMedia.length,
        total: pendingMedia.length,
        label: 'Creating ZIP bundle...',
        errors: []
      });

      const auction = await db.auctions.get(currentAuctionId);
      const auctionName = auction?.name || 'Unknown';

      setZipProgress(0);
      setSyncErrors([]);
      const { zipUrl, errors: zipErrors } = await createAndUploadZip({ 
        auctionId: currentAuctionId, 
        lotMetas: lots, 
        uploadedMedia: uploadedMedia, 
        csvText: csvContent,
        onProgress: setZipProgress 
      });
      
      // Store any sync errors for display
      setSyncErrors(zipErrors);

      // Step 5: Send email with ZIP link only
      setSyncProgress({
        current: pendingMedia.length,
        total: pendingMedia.length,
        label: 'Sending email with ZIP link...',
        errors: []
      });

      const emailResponse = await fetch('/api/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: `Mark App Export (ZIP) - ${auctionName}`,
          summary: `Export from ${auctionName} with ${uploadedMedia.length} media items - ZIP download link included`,
          auctionId: currentAuctionId,
          // csv: undefined,      // <-- ensure we do NOT send as attachment
          links: [zipUrl]        // <-- the single ZIP link
        }),
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok || emailResult?.ok !== true) {
        setSyncError(`Email failed: ${emailResult?.error || emailResponse.statusText}`);
        throw new Error(`Email failed: ${emailResult?.error || emailResponse.statusText}`);
      } else {
        setSyncError(null);
        setLastEmail({
          id: emailResult?.id ?? null,
          at: new Date().toISOString(),
          count: uploadedMedia.length
        });
        setZipDownloadUrl(zipUrl); // keep it in UI as a fallback
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

  // Fallback action functions
  const handleDownloadCSV = () => {
    if (csvText) {
      downloadTextFile('mark-app-export.csv', csvText);
    }
  };

  const handleCopyLinks = async () => {
    if (links.length > 0) {
      try {
        await copyToClipboard(links.join('\n'));
        showToastMessage(`Copied ${links.length} links`);
      } catch (error) {
        showToastMessage('Failed to copy links');
      }
    }
  };

  const handleResendLinksOnly = async () => {
    if (!currentAuctionId || links.length === 0) return;

    try {
      const auction = await db.auctions.get(currentAuctionId);
      const auctionName = auction?.name || 'Unknown';

      const emailResponse = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: `Mark App Export - ${auctionName} (links only)`, 
          summary: `Export from ${auctionName} with ${links.length} media links (no attachment)`,
          auctionId: currentAuctionId, 
          links 
        })
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok || emailResult?.ok !== true) {
        setSyncError(`Email (links-only) failed: ${emailResult?.error || emailResponse.statusText}`);
      } else {
        setSyncError(null);
        setLastEmail({ 
          id: emailResult?.id ?? null, 
          at: new Date().toISOString(), 
          count: links.length 
        });
        showToastMessage('Links-only email sent successfully');
      }
    } catch (error) {
      setSyncError(`Failed to resend email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ZIP export function
  async function createAndUploadZip({ auctionId, lotMetas, uploadedMedia, csvText, onProgress }:{
    auctionId: string,
    lotMetas: Array<{ id: string; title?: string }>,
    uploadedMedia: Array<{ id: string; lotId: string; index?: number; filename?: string; mime: string }>,
    csvText: string,
    onProgress?: (p:number)=>void
  }) {
    // Build list of { path, media } from local IndexedDB media items
    // Keep consistent names: media/<lotId>_<index|id>.<ext>
    const entries = []
    for (const m of uploadedMedia) {
      const ext = (m.mime?.includes('jpeg') ? 'jpg' : (m.mime?.split('/')[1] || 'bin'))
      const name = m.filename || `${m.lotId}_${(m.index ?? 0)}.${ext}`
      entries.push({ path: `media/${name}`, media: m })
    }

    const { blob: zipBlob, errors } = await buildZipBundle(entries, csvText, onProgress)
    const ts = new Date().toISOString().replace(/[:.]/g,'-')
    const objectKey = `exports/${auctionId}/export-${auctionId}-${ts}.zip`
    await uploadZipToR2(objectKey, zipBlob)
    const zipUrl = await presignZipGet(objectKey, 7*24*3600) // 7 days
    return { objectKey, zipUrl, errors }
  }

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

        {/* Delivery Confirmation Panel */}
        {lastEmail && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="text-blue-800 font-medium">✅ Email request accepted</span>
              </div>
              <button
                onClick={() => setLastEmail(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm text-blue-700">
              {lastEmail.id && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Resend ID:</span>
                  <code className="bg-blue-100 px-2 py-1 rounded text-xs font-mono">
                    {lastEmail.id}
                  </code>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium">Sent:</span>
                <span>{formatRelativeTime(lastEmail.at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Files:</span>
                <span>{lastEmail.count} media links</span>
              </div>
              <div className="pt-2">
                <a 
                  href="/api/_email-health" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  Check email health
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {syncError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800 font-medium">Email Error</span>
              </div>
              <button
                onClick={() => setSyncError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-red-700 text-sm mt-2">{syncError}</p>
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

        {/* ZIP Progress Indicator */}
        {zipProgress > 0 && zipProgress < 100 && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-purple-900">Creating ZIP Bundle</span>
              <span className="text-purple-700 font-medium">{zipProgress}%</span>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-purple-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${zipProgress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-purple-700">Building ZIP with CSV and media files...</p>
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

        {/* ZIP Download Panel */}
        {zipDownloadUrl && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mt-8">
            <h3 className="font-semibold text-purple-900 mb-4">ZIP Export Ready</h3>
            <p className="text-purple-700 text-sm mb-4">
              Your complete export (CSV + all media) is ready for download.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => window.open(zipDownloadUrl, '_blank')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download ZIP Now
              </button>
              <button
                onClick={async () => {
                  try {
                    await copyToClipboard(zipDownloadUrl);
                    showToastMessage('ZIP link copied to clipboard');
                  } catch (error) {
                    showToastMessage('Failed to copy ZIP link');
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                <Copy className="w-4 h-4" />
                Copy ZIP Link
              </button>
            </div>
          </div>
        )}

        {/* Sync Errors Panel */}
        {syncErrors.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h4 className="font-semibold text-orange-900">Sync Errors</h4>
              <span className="text-orange-700 text-sm">({syncErrors.length} files skipped)</span>
            </div>
            <p className="text-orange-700 text-sm mb-3">
              Some media files could not be included in the ZIP. The export completed successfully with the remaining files.
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-orange-800 font-medium hover:text-orange-900">
                View skipped files
              </summary>
              <div className="mt-2 space-y-1">
                {syncErrors.map((error, index) => (
                  <div key={index} className="text-orange-700 bg-orange-100 rounded px-2 py-1">
                    <span className="font-mono text-xs">{error.id}</span>
                    <span className="text-orange-600 ml-2">• {error.reason}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Fallback Actions Panel */}
        {(csvText || links.length > 0) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
            <h3 className="font-semibold text-gray-900 mb-4">Sync Complete - Fallback Actions</h3>
            <p className="text-gray-600 text-sm mb-4">
              Download your data locally or resend the email with different options.
            </p>
            <div className="flex flex-wrap gap-3">
              {csvText && (
                <button
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              )}
              {links.length > 0 && (
                <>
                  <button
                    onClick={handleCopyLinks}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Links
                  </button>
                  <button
                    onClick={handleResendLinksOnly}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                  >
                    <Mail className="w-4 h-4" />
                    Resend Email (Links Only)
                  </button>
                </>
              )}
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

        {/* Toast Message */}
        {showToast && (
          <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            {showToast}
          </div>
        )}
      </div>
    </div>
  );
}