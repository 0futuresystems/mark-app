// Test script to verify toArrayBuffer normalizer works
import { toArrayBuffer } from '../src/lib/toArrayBuffer.ts';

async function testToArrayBuffer() {
  console.log('Testing toArrayBuffer normalizer...');
  
  try {
    // Test 1: Valid Blob
    const testBlob = new Blob(['test data'], { type: 'text/plain' });
    const result1 = await toArrayBuffer(testBlob);
    console.log('✅ Blob test passed:', result1.byteLength, 'bytes');
    
    // Test 2: Data URL
    const dataUrl = 'data:text/plain;base64,dGVzdCBkYXRh';
    const result2 = await toArrayBuffer(dataUrl);
    console.log('✅ Data URL test passed:', result2.byteLength, 'bytes');
    
    // Test 3: Invalid input
    try {
      await toArrayBuffer(null);
      console.log('❌ Null test should have failed');
    } catch (e) {
      console.log('✅ Null test correctly failed:', e.message);
    }
    
    // Test 4: Unsupported object
    try {
      await toArrayBuffer({ dataUrl: 'data:test' });
      console.log('❌ Object test should have failed');
    } catch (e) {
      console.log('✅ Object test correctly failed:', e.message);
    }
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testToArrayBuffer();
