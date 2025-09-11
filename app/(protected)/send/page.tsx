'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../src/db';
import { Lot, MediaItem } from '../../../src/types';
import { syncPending, UploadProgress } from '../../../src/lib/uploadQueue';
import { toCSV, CsvRow } from '../../../src/lib/csv';
import { getCurrentAuction } from '../../../src/lib/currentAuction';
import { upsertLot } from '../../../src/lib/supabaseSync';
import { getMediaBlob } from '../../../src/lib/blobStore';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';

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
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{current: number; total: number; label: string} | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);

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

  const exportDataWithMedia = async () => {
    setExporting(true);
    setExportProgress({ current: 0, total: 0, label: 'Preparing export...' });
    
    try {
      const zip = new JSZip();
      const currentAuction = await getCurrentAuction();
      const auctionName = currentAuction?.name || 'Unknown';
      const today = new Date().toISOString().split('T')[0];
      
      // Generate CSV data
      setExportProgress({ current: 1, total: 3, label: 'Generating CSV data...' });
      const csvContent = await generateCSV();
      zip.file('lots_data.csv', csvContent);
      
      // Add media files
      setExportProgress({ current: 2, total: 3, label: 'Adding media files...' });
      const mediaFolder = zip.folder('media');
      let processedMedia = 0;
      const totalMedia = media.length;
      
      for (const mediaItem of media) {
        try {
          const blob = await getMediaBlob(mediaItem.id);
          if (blob) {
            // Determine file extension based on media type
            let extension = '';
            if (mediaItem.type === 'photo') {
              extension = blob.type.includes('jpeg') || blob.type.includes('jpg') ? '.jpg' : '.png';
            } else if (mediaItem.type === 'mainVoice' || mediaItem.type === 'dimensionVoice') {
              extension = blob.type.includes('webm') ? '.webm' : '.mp3';
            }
            
            const fileName = `${mediaItem.lotId}_${mediaItem.type}_${mediaItem.index}${extension}`;
            mediaFolder?.file(fileName, blob);
          } else {
            console.warn(`Missing media file for ${mediaItem.id}`);
          }
        } catch (error) {
          console.error(`Error processing media ${mediaItem.id}:`, error);
        }
        
        processedMedia++;
        setExportProgress({ 
          current: 2, 
          total: 3, 
          label: `Adding media files... (${processedMedia}/${totalMedia})` 
        });
      }
      
      // Generate and download ZIP
      setExportProgress({ current: 3, total: 3, label: 'Creating ZIP file...' });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const fileName = `lots_${auctionName.replace(/[^a-zA-Z0-9]/g, '_')}_${today}.zip`;
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setExportProgress(null);
      
    } catch (error) {
      console.error('Error creating ZIP export:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const markLotsAsSent = async () => {
    try {
      // Mark all lots in the current auction as 'sent'
      const lotIds = lots.map(lot => lot.id);
      await db.lots.where('id').anyOf(lotIds).modify({ status: 'sent' });
      
      // Update local state
      setLots(prev => prev.map(lot => ({ ...lot, status: 'sent' as const })));
      
      // Sync each lot to Supabase
      for (const lot of lots) {
        await upsertLot({ 
          id: lot.id, 
          auctionId: lot.auctionId, 
          number: lot.number, 
          status: 'sent' 
        });
      }
      
      console.log(`Marked ${lotIds.length} lots as sent for auction ${currentAuctionId}`);
    } catch (error) {
      console.error('Error marking lots as sent:', error);
    }
  };

  const downloadCSVWithMediaLinks = async () => {
    try {
      setExporting(true);
      setExportProgress({ current: 0, total: 2, label: 'Preparing CSV export...' });
      
      const currentAuction = await getCurrentAuction();
      const auctionName = currentAuction?.name || 'Unknown';
      
      // Prepare data for CSV export
      const exportData = {
        lots: lots.map(lot => ({
          id: lot.id,
          number: lot.number,
          auctionId: lot.auctionId,
          auctionName: auctionName,
          status: lot.status,
          createdAt: lot.createdAt.toISOString()
        })),
        media: media.map(mediaItem => ({
          id: mediaItem.id,
          lotId: mediaItem.lotId,
          type: mediaItem.type,
          index: mediaItem.index,
          uploaded: mediaItem.uploaded,
          remotePath: mediaItem.remotePath
        }))
      };
      
      setExportProgress({ current: 1, total: 2, label: 'Generating CSV with signed URLs...' });
      
      // Call the CSV export API
      const response = await fetch('/api/export/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData)
      });
      
      if (!response.ok) {
        throw new Error(`CSV export failed: ${response.statusText}`);
      }
      
      // Get the CSV content
      const csvContent = await response.text();
      
      // Download the CSV file
      const today = new Date().toISOString().split('T')[0];
      const fileName = `lots_${auctionName.replace(/[^a-zA-Z0-9]/g, '_')}_with_media_${today}.csv`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setExportProgress({ current: 2, total: 2, label: 'Download complete!' });
      
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Failed to download CSV. Please try again.');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const sendEmailPackage = async () => {
    if (!emailAddress.trim()) {
      alert('Please enter an email address');
      return;
    }
    
    try {
      setEmailSending(true);
      
      const currentAuction = await getCurrentAuction();
      const auctionName = currentAuction?.name || 'Unknown';
      
      // Prepare data for email export
      const exportData = {
        lots: lots.map(lot => ({
          id: lot.id,
          number: lot.number,
          auctionId: lot.auctionId,
          auctionName: auctionName,
          status: lot.status,
          createdAt: lot.createdAt.toISOString()
        })),
        media: media.map(mediaItem => ({
          id: mediaItem.id,
          lotId: mediaItem.lotId,
          type: mediaItem.type,
          index: mediaItem.index,
          uploaded: mediaItem.uploaded,
          remotePath: mediaItem.remotePath
        })),
        email: emailAddress.trim()
      };
      
      // Call the email export API
      const response = await fetch('/api/export/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Email sending failed');
      }
      
      if (result.mock) {
        alert('Email service not configured (RESEND_API_KEY missing). This is a mock response.');
      } else {
        alert('Email sent successfully! Check your inbox for the CSV file.');
      }
      
      setEmailModalOpen(false);
      setEmailAddress('');
      
    } catch (error) {
      console.error('Error sending email:', error);
      alert(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEmailSending(false);
    }
  };

  const handleUploadAndExport = async () => {
    const incompleteLots = getLotsWithWarnings();
    
    if (incompleteLots.length > 0) {
      const shouldContinue = confirm(
        `You have ${incompleteLots.length} incomplete lots (missing photos, main voice, or dimensions voice). You can still export data and mark lots as sent. Continue anyway?`
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
      
      // Export data with media as ZIP
      await exportDataWithMedia();
      
      // Mark lots as sent after successful export
      await markLotsAsSent();
      
    } catch (error) {
      console.error('Error during upload and export:', error);
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

        {exportProgress && (
          <div className="bg-emerald-50 border border-emerald-600 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-emerald-900">Exporting Data</span>
              <span className="text-emerald-700 font-medium">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-emerald-700">
              {exportProgress.label}
            </p>
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

        {/* Upload and Export Actions */}
        {allUploaded ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center mb-8">
            <h2 className="text-emerald-800 font-semibold mb-2">All uploaded ✓</h2>
            <p className="text-emerald-700 mb-6">All media has been successfully uploaded.</p>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={downloadCSVWithMediaLinks}
                  disabled={exporting}
                  className={`inline-flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    exporting
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {exporting ? 'Exporting...' : 'Download CSV (with media links)'}
                </button>
                
                <button
                  onClick={() => setEmailModalOpen(true)}
                  disabled={exporting}
                  className={`inline-flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    exporting
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email package
                </button>
              </div>
              
              <div className="text-center">
                <span className="text-gray-500 text-sm">or</span>
              </div>
              
              <button
                onClick={exportDataWithMedia}
                disabled={exporting}
                className={`inline-flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  exporting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700 shadow-sm hover:shadow-md'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                {exporting ? 'Exporting...' : 'Export Data with Media (ZIP)'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 space-y-4">
            <button
              onClick={handleUploadAndExport}
              disabled={uploading || exporting}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg transition-all duration-200 ${
                uploading || exporting
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              }`}
            >
              {uploading ? 'Uploading...' : exporting ? 'Exporting...' : 'Upload Pending & Export Data (ZIP)'}
            </button>
            
            <div className="text-center">
              <span className="text-gray-500 text-sm">or</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={downloadCSVWithMediaLinks}
                disabled={exporting}
                className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                  exporting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                }`}
              >
                <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exporting ? 'Exporting...' : 'Download CSV (with media links)'}
              </button>
              
              <button
                onClick={() => setEmailModalOpen(true)}
                disabled={exporting}
                className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                  exporting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'
                }`}
              >
                <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email package
              </button>
            </div>
            
            <div className="text-center">
              <span className="text-gray-500 text-sm">or</span>
            </div>
            
            <button
              onClick={exportDataWithMedia}
              disabled={exporting}
              className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                exporting
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-600 text-white hover:bg-gray-700 shadow-sm hover:shadow-md'
              }`}
            >
              {exporting ? 'Exporting...' : 'Export Data Only (ZIP)'}
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

        {/* Email Modal */}
        {emailModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Email Package</h3>
              <p className="text-gray-600 mb-4">
                Enter an email address to receive a CSV file with all lot data and signed media URLs.
              </p>
              
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={emailSending}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEmailModalOpen(false);
                    setEmailAddress('');
                  }}
                  disabled={emailSending}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={sendEmailPackage}
                  disabled={emailSending || !emailAddress.trim()}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    emailSending || !emailAddress.trim()
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {emailSending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

