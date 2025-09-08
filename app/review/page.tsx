'use client';

import { useState, useEffect } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem, MediaType } from '../../src/types';
import { uid } from '../../src/lib/id';
import { saveMediaBlob, deleteMediaBlob } from '../../src/lib/blobStore';
import { getMediaBlob } from '../../src/lib/blobStore';
import AudioRecorder from '../../src/components/AudioRecorder';

export default function ReviewPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotMedia, setLotMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLots();
  }, []);

  useEffect(() => {
    if (selectedLot) {
      loadLotMedia(selectedLot.id);
    }
  }, [selectedLot]);

  const loadLots = async () => {
    try {
      const allLots = await db.lots.orderBy('createdAt').reverse().toArray();
      setLots(allLots);
      setLoading(false);
    } catch (error) {
      console.error('Error loading lots:', error);
      setLoading(false);
    }
  };

  const loadLotMedia = async (lotId: string) => {
    try {
      const media = await db.media.where('lotId').equals(lotId).toArray();
      setLotMedia(media);
    } catch (error) {
      console.error('Error loading lot media:', error);
    }
  };

  const getPhotoCount = (lotId: string) => {
    return lotMedia.filter(m => m.lotId === lotId && m.type === 'photo').length;
  };

  const hasMainVoice = (lotId: string) => {
    return lotMedia.some(m => m.lotId === lotId && m.type === 'mainVoice');
  };

  const getFirstPhoto = (lotId: string) => {
    const photos = lotMedia.filter(m => m.lotId === lotId && m.type === 'photo');
    return photos.length > 0 ? photos[0] : null;
  };

  const isLotComplete = (lotId: string) => {
    const photos = lotMedia.filter(m => m.lotId === lotId && m.type === 'photo');
    const hasMainVoice = lotMedia.some(m => m.lotId === lotId && m.type === 'mainVoice');
    const hasDimensionsVoice = lotMedia.some(m => m.lotId === lotId && m.type === 'dimensionVoice');
    return photos.length >= 2 && hasMainVoice && hasDimensionsVoice;
  };

  const getLotWarnings = (lotId: string) => {
    const warnings: string[] = [];
    const photos = lotMedia.filter(m => m.lotId === lotId && m.type === 'photo');
    const hasMainVoice = lotMedia.some(m => m.lotId === lotId && m.type === 'mainVoice');
    const hasDimensionsVoice = lotMedia.some(m => m.lotId === lotId && m.type === 'dimensionVoice');
    
    if (photos.length === 0) {
      warnings.push('No photos');
    }
    if (!hasMainVoice) {
      warnings.push('No voice note');
    }
    if (!hasDimensionsVoice) {
      warnings.push('No dimensions voice');
    }
    
    return warnings;
  };

  const movePhoto = async (mediaId: string, direction: 'up' | 'down') => {
    const photos = lotMedia.filter(m => m.type === 'photo').sort((a, b) => a.index - b.index);
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
    try {
      await db.media.delete(mediaId);
      await deleteMediaBlob(mediaId);
      loadLotMedia(selectedLot!.id);
    } catch (error) {
      console.error('Error deleting media:', error);
    }
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
        uploaded: false
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
      uploaded: false
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
        uploaded: false
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
      uploaded: false
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
        uploaded: false
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Loading lots...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Review Data</h1>
      
      {!selectedLot ? (
        <div>
          <h2>Lots ({lots.length})</h2>
          {lots.length === 0 ? (
            <p>No lots found. <a href="/new">Create a new lot</a></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lots.map(lot => {
                const photoCount = getPhotoCount(lot.id);
                const hasVoice = hasMainVoice(lot.id);
                const firstPhoto = getFirstPhoto(lot.id);
                
                return (
                  <div 
                    key={lot.id} 
                    style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '8px', 
                      padding: '1rem',
                      cursor: 'pointer',
                      backgroundColor: '#f9f9f9'
                    }}
                    onClick={() => setSelectedLot(lot)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {firstPhoto && (
                        <div style={{ width: '60px', height: '60px', backgroundColor: '#eee', borderRadius: '4px' }}>
                          {/* Thumbnail placeholder */}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <h3>Lot #{lot.number}</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>
                          Created: {lot.createdAt.toLocaleDateString()}
                        </p>
                        <div style={{ marginTop: '0.5rem' }}>
                          {isLotComplete(lot.id) ? (
                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Complete</span>
                          ) : (
                            getLotWarnings(lot.id).map((warning, index) => (
                              <span key={index} style={{ color: '#dc3545', marginRight: index > 0 ? '1rem' : '0' }}>
                                {warning}
                              </span>
                            ))
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
          <div style={{ marginBottom: '2rem' }}>
            <button 
              onClick={() => setSelectedLot(null)}
              className="btn"
              style={{ marginBottom: '1rem' }}
            >
              ← Back to Lots
            </button>
            <h2>Lot #{selectedLot.number}</h2>
          </div>

          {/* Photos Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>Photos</h3>
            {lotMedia.filter(m => m.type === 'photo').sort((a, b) => a.index - b.index).map((photo, index) => (
              <div key={photo.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <span>#{photo.index}</span>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#eee', borderRadius: '4px' }}></div>
                <button 
                  onClick={() => movePhoto(photo.id, 'up')}
                  disabled={index === 0}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  ↑
                </button>
                <button 
                  onClick={() => movePhoto(photo.id, 'down')}
                  disabled={index === lotMedia.filter(m => m.type === 'photo').length - 1}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  ↓
                </button>
                <button 
                  onClick={() => deleteMedia(photo.id)}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          {/* Main Voice Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>Main Voice</h3>
            {lotMedia.find(m => m.type === 'mainVoice') ? (
              <div>
                <p style={{ color: '#28a745' }}>Recorded ✓</p>
                <AudioRecorder onBlob={handleMainVoiceRecord} />
                <p style={{ fontSize: '0.9rem', color: '#666' }}>Re-record to replace</p>
              </div>
            ) : (
              <div>
                <p style={{ color: '#dc3545' }}>Not recorded</p>
                <AudioRecorder onBlob={handleMainVoiceRecord} />
              </div>
            )}
          </div>

          {/* Dimension Voice Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>Dimension Voice Notes (Optional)</h3>
            {lotMedia.filter(m => m.type === 'dimensionVoice').sort((a, b) => a.index - b.index).map(voice => (
              <div key={voice.id} style={{ marginBottom: '0.5rem' }}>
                <span>Note #{voice.index}</span>
                <button 
                  onClick={() => deleteMedia(voice.id)}
                  style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Delete
                </button>
              </div>
            ))}
            {lotMedia.filter(m => m.type === 'dimensionVoice').length < 4 && (
              <div>
                <button onClick={addDimensionVoice} className="btn" style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}>
                  Add Dimension Voice Note
                </button>
                <AudioRecorder onBlob={handleDimensionVoiceRecord} />
              </div>
            )}
          </div>

          {/* Keyword Voice Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>Keyword Voice Notes (Optional)</h3>
            {lotMedia.filter(m => m.type === 'keywordVoice').sort((a, b) => a.index - b.index).map(voice => (
              <div key={voice.id} style={{ marginBottom: '0.5rem' }}>
                <span>Note #{voice.index}</span>
                <button 
                  onClick={() => deleteMedia(voice.id)}
                  style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Delete
                </button>
              </div>
            ))}
            {lotMedia.filter(m => m.type === 'keywordVoice').length < 5 && (
              <div>
                <button onClick={addKeywordVoice} className="btn" style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}>
                  Add Keyword Voice Note
                </button>
                <AudioRecorder onBlob={handleKeywordVoiceRecord} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
