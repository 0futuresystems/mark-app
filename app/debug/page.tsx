'use client';

import { useState, useEffect } from 'react';
import { db } from '../../src/db';
import { Lot, MediaItem, Auction } from '../../src/types';
import { uid } from '../../src/lib/id';
import { nextLotNumber } from '../../src/lib/lotNumber';

export default function DebugPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allLots, allMedia, allAuctions] = await Promise.all([
        db.lots.toArray(),
        db.media.toArray(),
        db.auctions.toArray()
      ]);
      
      setLots(allLots);
      setMedia(allMedia);
      setAuctions(allAuctions);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const createTestData = async () => {
    setIsCreating(true);
    try {
      console.log('Creating test data for bug sweep...');
      
      // Clear existing data first
      await db.lots.clear();
      await db.media.clear();
      await db.blobs.clear();
      await db.auctions.clear();
      await db.meta.clear();
      
      // Create Auction A
      const auctionA: Auction = {
        id: uid(),
        name: 'Auction A',
        createdAt: Date.now()
      };
      await db.auctions.add(auctionA);
      console.log('Created Auction A:', auctionA.id);
      
      // Create Auction B
      const auctionB: Auction = {
        id: uid(),
        name: 'Auction B', 
        createdAt: Date.now()
      };
      await db.auctions.add(auctionB);
      console.log('Created Auction B:', auctionB.id);
      
      // Create 3 lots for Auction A with minimal media (1 photo + 1 main voice each)
      for (let i = 1; i <= 3; i++) {
        const lotNumber = await nextLotNumber(auctionA.id);
        const lot: Lot = {
          id: uid(),
          number: lotNumber,
          auctionId: auctionA.id,
          status: 'complete',
          createdAt: new Date()
        };
        await db.lots.add(lot);
        
        // Add 1 photo
        const photoMedia: MediaItem = {
          id: uid(),
          lotId: lot.id,
          type: 'photo',
          index: 1,
          createdAt: new Date(),
          uploaded: false,
          mime: 'image/jpeg',
          bytesSize: 0
        };
        await db.media.add(photoMedia);
        
        // Add 1 main voice
        const voiceMedia: MediaItem = {
          id: uid(),
          lotId: lot.id,
          type: 'mainVoice',
          index: 1,
          createdAt: new Date(),
          uploaded: false,
          mime: 'audio/webm',
          bytesSize: 0
        };
        await db.media.add(voiceMedia);
        
        console.log(`Created Lot ${lotNumber} for Auction A with minimal media`);
      }
      
      // Create 1 incomplete lot for Auction B (no media - should be cleaned up on exit)
      const incompleteLotNumber = await nextLotNumber(auctionB.id);
      const incompleteLot: Lot = {
        id: uid(),
        number: incompleteLotNumber,
        auctionId: auctionB.id,
        status: 'draft',
        createdAt: new Date()
      };
      await db.lots.add(incompleteLot);
      console.log(`Created incomplete Lot ${incompleteLotNumber} for Auction B (no media)`);
      
      console.log('Test data creation completed!');
      await loadData(); // Refresh the display
      
    } catch (error) {
      console.error('Error creating test data:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Debug - Database Contents</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={createTestData} 
          disabled={isCreating}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isCreating ? 'not-allowed' : 'pointer',
            opacity: isCreating ? 0.6 : 1,
            marginRight: '1rem'
          }}
        >
          {isCreating ? 'Creating...' : 'Create Test Data'}
        </button>
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

      <div style={{ marginBottom: '2rem' }}>
        <h2>Auctions ({auctions.length})</h2>
        {auctions.map(auction => (
          <div key={auction.id} style={{ 
            padding: '1rem', 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            <strong>{auction.name}</strong> (ID: {auction.id})<br/>
            Created: {new Date(auction.createdAt).toISOString()}
          </div>
        ))}
      </div>
      
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
            Auction ID: {lot.auctionId}<br/>
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
    </div>
  );
}
