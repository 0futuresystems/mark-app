// Test function to verify Supabase sync functionality
import { upsertAuction, upsertLot, upsertMedia, getSyncQueueStatus } from './supabaseSync'

export async function testSupabaseSync() {
  console.log('Testing Supabase sync functionality...')
  
  try {
    // Test auction sync
    const testAuction = {
      id: 'test-auction-' + Date.now(),
      name: 'Test Auction for Sync'
    }
    
    console.log('Testing auction sync...')
    await upsertAuction(testAuction)
    console.log('✅ Auction sync test passed')
    
    // Test lot sync
    const testLot = {
      id: 'test-lot-' + Date.now(),
      auctionId: testAuction.id,
      number: 'TEST-001',
      status: 'draft' as const
    }
    
    console.log('Testing lot sync...')
    await upsertLot(testLot)
    console.log('✅ Lot sync test passed')
    
    // Test media sync
    const testMedia = {
      id: 'test-media-' + Date.now(),
      lotId: testLot.id,
      kind: 'photo' as const,
      r2Key: 'Lot-TEST-001/photo/test-media-id',
      bytes: 1024,
      width: 1920,
      height: 1080,
      indexInLot: 1
    }
    
    console.log('Testing media sync...')
    await upsertMedia(testMedia)
    console.log('✅ Media sync test passed')
    
    // Check queue status
    const queueStatus = getSyncQueueStatus()
    console.log('Sync queue status:', queueStatus)
    
    console.log('🎉 All sync tests passed!')
    return true
    
  } catch (error) {
    console.error('❌ Sync test failed:', error)
    return false
  }
}
