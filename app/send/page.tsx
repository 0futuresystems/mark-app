'use client';

import { useState, useEffect } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem } from '../../src/types';
import { syncPending, UploadProgress } from '../../src/lib/uploadQueue';
import { toCSV } from '../../src/lib/csv';

export default function SendPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [allUploaded, setAllUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allLots, allMedia] = await Promise.all([
        db.lots.toArray(),
        db.media.toArray()
      ]);
      
      setLots(allLots);
      setMedia(allMedia);
      
      // Check if all media is uploaded
      const pendingMedia = allMedia.filter(m => !m.uploaded);
      setAllUploaded(pendingMedia.length === 0);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

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
    const csvRows: Record<string, any>[] = [];
    
    lots.forEach(lot => {
      const lotMedia = media.filter(m => m.lotId === lot.id);
      
      if (lotMedia.length === 0) {
        // Lot with no media
        csvRows.push({
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
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lots.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleUploadAndCSV = async () => {
    const incompleteLots = getLotsWithWarnings();
    
    if (incompleteLots.length > 0) {
      const shouldContinue = confirm(
        `You still have ${incompleteLots.length} incomplete lots (missing photos, main voice, or dimensions voice). You can still upload CSV, but media won't be exported yet. Continue anyway?`
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Send Data</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Total Lots</h3>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{lots.length}</p>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Lots with Warnings</h3>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#dc3545' }}>
              {getLotsWithWarnings().length}
            </p>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Total Media Items</h3>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{media.length}</p>
          </div>
          <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Pending Upload</h3>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#ffc107' }}>
              {media.filter(m => !m.uploaded).length}
            </p>
          </div>
        </div>
      </div>

      {uploadProgress && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e3f2fd', 
          border: '1px solid #bbdefb', 
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold' }}>Uploading {uploadProgress.done} of {uploadProgress.total}</span>
            <span>{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            backgroundColor: '#e0e0e0', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${(uploadProgress.done / uploadProgress.total) * 100}%`, 
              height: '100%', 
              backgroundColor: '#2196f3',
              transition: 'width 0.3s ease'
            }} />
          </div>
          {uploadProgress.label && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              {uploadProgress.label}
            </p>
          )}
        </div>
      )}

      {uploadResult && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: uploadResult.failed > 0 ? '#fff3cd' : '#d4edda', 
          border: `1px solid ${uploadResult.failed > 0 ? '#ffeaa7' : '#c3e6cb'}`, 
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Upload Results</h3>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            ✅ Success: {uploadResult.success} | ❌ Failed: {uploadResult.failed} | ⏭️ Skipped: {uploadResult.skipped}
          </p>
          {uploadResult.errors.length > 0 && (
            <div>
              <strong>Errors:</strong>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {uploadResult.errors.map((error: string, index: number) => (
                  <li key={index} style={{ fontSize: '0.9rem', color: '#666' }}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {allUploaded ? (
        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb', 
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: '#155724', margin: '0 0 1rem 0' }}>All uploaded ✓</h2>
          <p style={{ color: '#155724', margin: 0 }}>All media has been successfully uploaded.</p>
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={handleUploadAndCSV}
            disabled={uploading}
            className="btn"
            style={{
              opacity: uploading ? 0.6 : 1,
              cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Pending & Generate CSV'}
          </button>
        </div>
      )}

      {getLotsWithWarnings().length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2>Lots with Warnings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {getLotsWithWarnings().map(lot => (
              <div key={lot.id} style={{ 
                padding: '1rem', 
                backgroundColor: '#f8d7da', 
                border: '1px solid #f5c6cb', 
                borderRadius: '4px' 
              }}>
                <strong>Lot #{lot.number}</strong>: {getLotWarnings(lot.id).join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

