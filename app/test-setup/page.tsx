'use client';

import { useState } from 'react';
import { db } from '../../src/db';
import { uid } from '../../src/lib/id';
import { nextLotNumber } from '../../src/lib/lotNumber';
import { Auction, Lot, MediaItem } from '../../src/types';

export default function TestSetupPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<string>('');

  const createTestData = async () => {
    setIsCreating(true);
    setResult('');
    
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
      
      const successMessage = `Test data creation completed!
Auction A: ${auctionA.id} with 3 complete lots
Auction B: ${auctionB.id} with 1 incomplete lot

You can now:
1. Go to /new to test lot creation
2. Go to /review to test review functionality  
3. Go to /send to test CSV generation
4. Check /debug to see all data`;
      
      setResult(successMessage);
      console.log('Test data creation completed!');
      
    } catch (error) {
      console.error('Error creating test data:', error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const clearData = async () => {
    setIsCreating(true);
    setResult('');
    
    try {
      await db.lots.clear();
      await db.media.clear();
      await db.blobs.clear();
      await db.auctions.clear();
      await db.meta.clear();
      
      setResult('All data cleared successfully!');
    } catch (error) {
      console.error('Error clearing data:', error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Test Setup</h1>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Bug Sweep Test Data</h2>
          <p className="text-gray-600 mb-6">
            This will create test data for the bug sweep scenarios:
            <br />• Auction A with 3 complete lots (minimal media)
            <br />• Auction B with 1 incomplete lot (no media)
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={createTestData}
              disabled={isCreating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isCreating ? 'Creating...' : 'Create Test Data'}
            </button>
            
            <button
              onClick={clearData}
              disabled={isCreating}
              className="px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isCreating ? 'Clearing...' : 'Clear All Data'}
            </button>
          </div>
        </div>
        
        {result && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Result</h3>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {result}
            </pre>
          </div>
        )}
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Scenarios</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>1. <strong>Per-auction numbering:</strong> Check that lots in Auction A are numbered 0001, 0002, 0003</div>
            <div>2. <strong>Review page:</strong> Verify big thumbnails and completeness badges</div>
            <div>3. <strong>Add Photo:</strong> Test adding photos to existing lots</div>
            <div>4. <strong>Audio playback:</strong> Test audio recording and playback</div>
            <div>5. <strong>Send Data:</strong> Generate CSV and mark lots as sent</div>
            <div>6. <strong>Quick Overview:</strong> Verify status updates after sending</div>
            <div>7. <strong>Incomplete lot cleanup:</strong> Verify incomplete lots are not saved on exit</div>
          </div>
        </div>
      </div>
    </div>
  );
}
