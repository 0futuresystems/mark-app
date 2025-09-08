'use client';

import { useState, useEffect } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem } from '../../src/types';

export default function DebugPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Debug - Database Contents</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Lots ({lots.length})</h2>
        {lots.map(lot => (
          <div key={lot.id} style={{ 
            padding: '1rem', 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            <strong>Lot #{lot.number}</strong> (ID: {lot.id})<br/>
            Status: {lot.status}<br/>
            Created: {lot.createdAt.toISOString()}
          </div>
        ))}
      </div>

      <div>
        <h2>Media Items ({media.length})</h2>
        {media.map(item => (
          <div key={item.id} style={{ 
            padding: '1rem', 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            <strong>{item.type}</strong> (ID: {item.id})<br/>
            Lot ID: {item.lotId}<br/>
            Index: {item.index}<br/>
            Uploaded: {item.uploaded ? 'Yes' : 'No'}<br/>
            Created: {item.createdAt.toISOString()}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button onClick={loadData} style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Refresh Data
        </button>
      </div>
    </div>
  );
}
