'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem, Auction } from '../../src/types';
import { syncPending, UploadProgress } from '../../src/lib/uploadQueue';
import { toCSV } from '../../src/lib/csv';
import AuctionSelector from '../../src/components/AuctionSelector';

export default function SendPage() {
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [allUploaded, setAllUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<{success: number; failed: number; skipped: number; errors: string[]} | null>(null);

  const loadAuctions = useCallback(async () => {
    try {
      const allAuctions = await db.auctions.orderBy('createdAt').reverse().toArray();
      setAuctions(allAuctions);
      
      // If no current auction is selected, select the first one
      if (!currentAuctionId && allAuctions.length > 0) {
        setCurrentAuctionId(allAuctions[0].id);
      }
    } catch (error) {
      console.error('Error loading auctions:', error);
    }
  }, [currentAuctionId]);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  useEffect(() => {
    loadData();
  }, [loadData]);


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

  const generateCSV = () => {
    const csvRows: Record<string, string | number>[] = [];
    const currentAuction = auctions.find(a => a.id === currentAuctionId);
    const auctionName = currentAuction?.name || 'Unknown';
    
    lots.forEach(lot => {
      const lotMedia = media.filter(m => m.lotId === lot.id);
      
      if (lotMedia.length === 0) {
        // Lot with no media
        csvRows.push({
          auctionId: currentAuctionId || '',
          auctionName: auctionName,
          lotNumber: lot.number,
          status: lot.status,
          createdAt: lot.createdAt.toISOString(),
          mediaType: '',
          index: '',
          fileName: '',
          size: '',
          uploaded: '',
          remotePath: ''
        });
      } else {
        // Lot with media
        lotMedia.forEach(mediaItem => {
          csvRows.push({
            auctionId: currentAuctionId || '',
            auctionName: auctionName,
            lotNumber: lot.number,
            status: lot.status,
            createdAt: lot.createdAt.toISOString(),
            mediaType: mediaItem.type,
            index: mediaItem.index,
            fileName: `${mediaItem.type}-${mediaItem.index}`,
            size: '', // Could be populated from blob data if needed
            uploaded: mediaItem.uploaded,
            remotePath: mediaItem.remotePath || ''
          });
        });
      }
    });
    
    return toCSV(csvRows);
  };

  const downloadCSV = (csvContent: string) => {
    const currentAuction = auctions.find(a => a.id === currentAuctionId);
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
      const csvContent = generateCSV();
      downloadCSV(csvContent);
      
      // Mark lots as sent after successful export
      await markLotsAsSent();
      
    } catch (error) {
      console.error('Error during upload and CSV generation:', error);
      alert('Error during upload. Check console for details.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading...</h1>
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
            <h1 className="text-3xl font-bold text-gray-900">Send Data</h1>
            <p className="text-gray-600 mt-1">Upload and export your lot data</p>
          </div>
          <AuctionSelector 
            currentAuctionId={currentAuctionId}
            onAuctionChange={setCurrentAuctionId}
          />
        </div>
      
        {/* Summary Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Total Lots</h3>
              <p className="text-2xl font-bold text-gray-900">{lots.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Lots with Warnings</h3>
              <p className="text-2xl font-bold text-red-600">
                {getLotsWithWarnings().length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Total Media Items</h3>
              <p className="text-2xl font-bold text-gray-900">{media.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Upload</h3>
              <p className="text-2xl font-bold text-yellow-600">
                {media.filter(m => !m.uploaded).length}
              </p>
            </div>
          </div>
        </div>

        {uploadProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-blue-900">Uploading {uploadProgress.done} of {uploadProgress.total}</span>
              <span className="text-blue-700 font-medium">{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300 ease-out"
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
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-green-50 border border-green-200'
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center mb-8">
            <h2 className="text-green-800 font-semibold mb-2">All uploaded ✓</h2>
            <p className="text-green-700">All media has been successfully uploaded.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <button
              onClick={handleUploadAndCSV}
              disabled={uploading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
                uploading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md'
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
                <div key={lot.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-red-900">Lot #{lot.number}</strong>
                      <span className="text-red-700 ml-2">{getLotWarnings(lot.id).join(', ')}</span>
                    </div>
                    <span className="text-sm text-red-600 font-medium">
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

