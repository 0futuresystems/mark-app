'use client';

import { useState } from 'react';
import { db } from '../../src/db';
import { uid } from '../../src/lib/id';
import { nextLotNumber } from '../../src/lib/lotNumber';
import { Auction, Lot, MediaItem } from '../../src/types';

export default function TestSetupPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<string>('');

  // Helper function to create test image blobs
  const createTestImageBlob = async (width: number, height: number, color: string, text: string, format: 'jpeg' | 'png' = 'jpeg'): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Fill background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = `${Math.floor(height * 0.1)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    
    // Add border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.9);
    });
  };

  // Helper function to create HEIC-like blob (simulate non-web format)
  const createHEICLikeBlob = async (width: number, height: number, text: string): Promise<Blob> => {
    // Create a blob with HEIC-like header to simulate iPhone HEIC files
    const header = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftypheic
      0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, // heic
      0x6D, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63, // mif1heic
      0x00, 0x00, 0x00, 0x00 // padding
    ]);
    
    // Add some dummy data to make it substantial
    const dummyData = new Uint8Array(5000).fill(0xFF);
    
    const combined = new Uint8Array(header.length + dummyData.length);
    combined.set(header, 0);
    combined.set(dummyData, header.length);
    
    return new Blob([combined], { type: 'image/heic' });
  };

  const createTestData = async () => {
    setIsCreating(true);
    setResult('');
    
    try {
      console.log('Creating test data with REAL IMAGE BLOBS for testing...');
      
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
      
      // Create different test scenarios for Auction A
      const testScenarios = [
        { format: 'jpeg', color: '#3B82F6', text: 'JPEG Test' },
        { format: 'png', color: '#10B981', text: 'PNG Test' },
        { format: 'heic', color: '#F59E0B', text: 'HEIC Test' }
      ] as const;
      
      for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        const lotNumber = await nextLotNumber(auctionA.id);
        const lot: Lot = {
          id: uid(),
          number: lotNumber,
          auctionId: auctionA.id,
          status: 'complete',
          createdAt: new Date()
        };
        await db.lots.add(lot);
        
        // Create multiple photos for each lot to test lightbox navigation
        for (let photoIndex = 1; photoIndex <= 3; photoIndex++) {
          const photoMediaId = uid();
          let blob: Blob;
          let mimeType: string;
          
          if (scenario.format === 'heic') {
            blob = await createHEICLikeBlob(800, 600, `${scenario.text} #${photoIndex}`);
            mimeType = 'image/heic';
          } else {
            blob = await createTestImageBlob(800, 600, scenario.color, `${scenario.text} #${photoIndex}`, scenario.format);
            mimeType = scenario.format === 'jpeg' ? 'image/jpeg' : 'image/png';
          }
          
          console.log(`[DEBUG_IMAGES] Created ${scenario.format} blob:`, {
            mediaId: photoMediaId,
            size: blob.size,
            type: blob.type,
            mimeType: mimeType
          });
          
          // Save the actual blob data
          await db.blobs.put({
            id: photoMediaId,
            data: blob
          });
          
          // Create MediaItem record with correct size
          const photoMedia: MediaItem = {
            id: photoMediaId,
            lotId: lot.id,
            type: 'photo',
            index: photoIndex,
            createdAt: new Date(),
            uploaded: false,
            mime: mimeType,
            bytesSize: blob.size
          };
          await db.media.add(photoMedia);
          
          console.log(`[DEBUG_IMAGES] Created photo ${photoIndex} for Lot ${lotNumber}:`, {
            id: photoMediaId,
            format: scenario.format,
            size: blob.size,
            mime: mimeType
          });
        }
        
        console.log(`Created Lot ${lotNumber} with 3 ${scenario.format.toUpperCase()} photos`);
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
      
      const successMessage = `✅ Test data creation with REAL IMAGE BLOBS completed!

🔹 Auction A: ${auctionA.id} with 3 lots:
  • Lot 0001: 3 JPEG photos (blue)
  • Lot 0002: 3 PNG photos (green) 
  • Lot 0003: 3 HEIC photos (orange) - tests format conversion
🔹 Auction B: ${auctionB.id} with 1 incomplete lot (no media)

Test scenarios created:
✓ JPEG images (web-friendly format)
✓ PNG images (web-friendly format)  
✓ HEIC images (should show issues then get fixed)

Now test:
1. Go to /review to see thumbnail rendering
2. Click photos to test lightbox navigation
3. Check console for [DEBUG_IMAGES] logs
4. Verify HEIC images show black tiles (proving Hypothesis A)`;
      
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
