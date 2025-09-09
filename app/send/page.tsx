'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem } from '../../src/types';
import { syncPending, UploadProgress } from '../../src/lib/uploadQueue';
import { toCSV, CsvRow } from '../../src/lib/csv';
import { getCurrentAuction } from '../../src/lib/currentAuction';
import { useRouter } from 'next/navigation';

export default function SendPage() {
  const router = useRouter();
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [allUploaded, setAllUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<{success: number; failed: number; skipped: number; errors: string[]} | null>(null);

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
      setAllUploaded(true);
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
      
      // Check if all media is uploaded
      const pendingMedia = auctionMedia.filter(m => !m.uploaded);
      setAllUploaded(pendingMedia.length === 0);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }, [currentAuctionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getLotWarnings = (lotId: string) => {
    const lotMedia = media.filter(m => m.lotId === lotId);
    const photoCount = lotMedia.filter(m => m.type === 'photo').length;
    const hasMainVoice = lotMedia.some(m => m.type === 'mainVoice');
    const hasDimensionsVoice = lotMedia.some(m => m.type === 'dimensionVoice');
    
    const warnings = [];
    if (photoCount === 0) warnings.push('Missing photos');
    if (!hasMainVoice) warnings.push('Missing main voice');
    if (!hasDimensionsVoice) warnings.push('Missing dimensions voice');
    
    return warnings;
  };

  const getLotsWithWarnings = () => {
    return lots.filter(lot => {
      const lotMedia = media.filter(m => m.lotId === lot.id);
      const photoCount = lotMedia.filter(m => m.type === 'photo').length;
      const hasMainVoice = lotMedia.some(m => m.type === 'mainVoice');
      const hasDimensionsVoice = lotMedia.some(m => m.type === 'dimensionVoice');
      return photoCount < 2 || !hasMainVoice || !hasDimensionsVoice;
    });
  };

  const generateCSV = async () => {
    const csvRows: CsvRow[] = [];
    const currentAuction = await getCurrentAuction();
    const auctionName = currentAuction?.name || 'Unknown';
    
    lots.forEach(lot => {
      const lotMedia = media.filter(m => m.lotId === lot.id);
      
      if (lotMedia.length === 0) {
        // Lot with no media
        csvRows.push({
          lotId: lot.id,
          auctionId: currentAuctionId || '',
          auctionName: auctionName,
          lotNumber: lot.number,
          status: lot.status,
          createdAt: lot.createdAt.toISOString(),
          mediaType: '',
          index: 0,
          fileName: '',
          size: '',
          uploaded: '',
          remotePath: ''
        });
      } else {
        // Lot with media
        lotMedia.forEach(mediaItem => {
          csvRows.push({
            lotId: lot.id,
            auctionId: currentAuctionId || '',
            auctionName: auctionName,
            lotNumber: lot.number,
            status: lot.status,
            createdAt: lot.createdAt.toISOString(),
            mediaType: mediaItem.type,
            index: mediaItem.index,
            fileName: `${mediaItem.type}-${mediaItem.index}`,
            size: '', // Could be populated from blob data if needed
            uploaded: mediaItem.uploaded ? 'true' : 'false',
            remotePath: mediaItem.remotePath || ''
          });
        });
      }
    });
    
    return toCSV(csvRows);
  };

  const downloadCSV = async (csvContent: string) => {
    const currentAuction = await getCurrentAuction();
    const auctionName = currentAuction?.name || 'Unknown';
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const fileName = `lots_${auctionName.replace(/[^a-zA-Z0-9]/g, '_')}_${today}.csv`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const markLotsAsSent = async () => {
    try {
      // Mark all lots in the current auction as 'sent'
      const lotIds = lots.map(lot => lot.id);
      await db.lots.where('id').anyOf(lotIds).modify({ status: 'sent' });
      
      // Update local state
      setLots(prev => prev.map(lot => ({ ...lot, status: 'sent' as const })));
      
      console.log(`Marked ${lotIds.length} lots as sent for auction ${currentAuctionId}`);
    } catch (error) {
      console.error('Error marking lots as sent:', error);
    }
  };

  const handleUploadAndCSV = async () => {
    const incompleteLots = getLotsWithWarnings();
    
    if (incompleteLots.length > 0) {
      const shouldContinue = confirm(
        `You have ${incompleteLots.length} incomplete lots (missing photos, main voice, or dimensions voice). You can still export CSV and mark lots as sent. Continue anyway?`
      );
      
      if (!shouldContinue) {
        return;
      }
    }
    
    setUploading(true);
    setUploadProgress(null);
    setUploadResult(null);
    
    try {
      // Upload pending media with progress tracking
      const result = await syncPending((progress) => {
        setUploadProgress(progress);
      });
      
      setUploadResult(result);
      
      // Reload data to get updated upload status
      await loadData();
      
      // Generate and download CSV
      const csvContent = await generateCSV();
      await downloadCSV(csvContent);
      
      // Mark lots as sent after successful export
      await markLotsAsSent();
      
    } catch (error) {
      console.error('Error during upload and CSV generation:', error);
      // TODO: Replace with proper toast notification
      alert('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Send Data</h1>
            <p className="text-gray-600 mt-1">Upload and export your lot data</p>
          </div>
        </div>
      
        {/* Summary Section */}
        {lots.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No lots to send yet</h3>
            <p className="text-gray-600 mb-6">Create some lots first, then come back to upload and export your data.</p>
            <a 
              href="/new" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create your first lot
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">Total Lots</h3>
                <p className="text-2xl font-bold text-gray-900">{lots.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">Lots with Warnings</h3>
                <p className="text-2xl font-bold text-rose-600">
                  {getLotsWithWarnings().length}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">Total Media Items</h3>
                <p className="text-2xl font-bold text-gray-900">{media.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Upload</h3>
                <p className="text-2xl font-bold text-gray-600">
                  {media.filter(m => !m.uploaded).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {uploadProgress && (
          <div className="bg-blue-50 border border-blue-600 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-blue-900">Uploading {uploadProgress.done} of {uploadProgress.total}</span>
              <span className="text-blue-700 font-medium">{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
              />
            </div>
            {uploadProgress.label && (
              <p className="mt-2 text-sm text-blue-700">
                {uploadProgress.label}
              </p>
            )}
          </div>
        )}

        {uploadResult && (
          <div className={`rounded-lg p-4 mb-8 ${
            uploadResult.failed > 0 
              ? 'bg-gray-50 border border-gray-200' 
              : 'bg-emerald-50 border border-emerald-200'
          }`}>
            <h3 className="font-semibold text-gray-900 mb-2">Upload Results</h3>
            <p className="text-sm text-gray-700 mb-2">
              ✅ Success: {uploadResult.success} | ❌ Failed: {uploadResult.failed} | ⏭️ Skipped: {uploadResult.skipped}
            </p>
            {uploadResult.errors.length > 0 && (
              <div>
                <strong className="text-sm font-medium text-gray-900">Errors:</strong>
                <ul className="mt-1 ml-4 text-sm text-gray-600">
                  {uploadResult.errors.map((error: string, index: number) => (
                    <li key={index} className="list-disc">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Upload Action */}
        {allUploaded ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center mb-8">
            <h2 className="text-emerald-800 font-semibold mb-2">All uploaded ✓</h2>
            <p className="text-emerald-700">All media has been successfully uploaded.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <button
              onClick={handleUploadAndCSV}
              disabled={uploading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-200 ${
                uploading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload Pending & Generate CSV'}
            </button>
          </div>
        )}

        {/* Lots with Warnings */}
        {getLotsWithWarnings().length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Lots with Warnings</h2>
            <div className="space-y-3">
              {getLotsWithWarnings().map(lot => (
                <div key={lot.id} className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-rose-900">Lot #{lot.number}</strong>
                      <span className="text-rose-700 ml-2">{getLotWarnings(lot.id).join(', ')}</span>
                    </div>
                    <span className="text-sm text-rose-600 font-medium">
                      {lot.status === 'sent' ? 'Sent' : lot.status}
                    </span>
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

