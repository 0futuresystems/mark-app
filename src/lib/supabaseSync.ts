import { supabase } from './supabaseClient'
import { Auction, Lot, MediaItem } from '../types'

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

// Queue for failed sync operations
const syncQueue: Array<() => Promise<void>> = []

// Toast notification function (will be set by the app)
let showToast: ((message: string, type: 'success' | 'error') => void) | null = null

export function setSyncToastHandler(handler: (message: string, type: 'success' | 'error') => void) {
  showToast = handler
}

// Helper function to show toast notifications
function notifyToast(message: string, type: 'success' | 'error') {
  if (showToast) {
    showToast(message, type)
  } else {
    console.log(`Toast: ${type.toUpperCase()} - ${message}`)
  }
}

// Helper function to retry operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T | null> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.warn(`${operationName} attempt ${attempt} failed:`, error)
      
      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
      }
    }
  }
  
  console.error(`${operationName} failed after ${maxRetries} attempts:`, lastError)
  return null
}

// Upsert auction to Supabase
export async function upsertAuction(auction: { id: string; name: string }): Promise<void> {
  const operation = async () => {
    const { error } = await supabase
      .from('auctions')
      .upsert({
        id: auction.id,
        name: auction.name,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (error) {
      throw new Error(`Failed to sync auction: ${error.message}`)
    }
  }

  const result = await withRetry(operation, `upsertAuction(${auction.id})`)
  
  if (result === null) {
    // Add to retry queue
    syncQueue.push(() => upsertAuction(auction))
    notifyToast(`Failed to sync auction "${auction.name}". Will retry later.`, 'error')
  } else {
    console.log(`Successfully synced auction: ${auction.id} - ${auction.name}`)
  }
}

// Upsert lot to Supabase
export async function upsertLot(lot: { 
  id: string; 
  auctionId: string; 
  number: string; 
  status: 'draft' | 'complete' | 'sent' 
}): Promise<void> {
  const operation = async () => {
    const { error } = await supabase
      .from('lots')
      .upsert({
        id: lot.id,
        auction_id: lot.auctionId,
        number: lot.number,
        status: lot.status,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (error) {
      throw new Error(`Failed to sync lot: ${error.message}`)
    }
  }

  const result = await withRetry(operation, `upsertLot(${lot.id})`)
  
  if (result === null) {
    // Add to retry queue
    syncQueue.push(() => upsertLot(lot))
    notifyToast(`Failed to sync lot #${lot.number}. Will retry later.`, 'error')
  } else {
    console.log(`Successfully synced lot: ${lot.id} - #${lot.number} (${lot.status})`)
  }
}

// Process the retry queue
export async function processSyncQueue(): Promise<void> {
  if (syncQueue.length === 0) return
  
  console.log(`Processing ${syncQueue.length} queued sync operations...`)
  
  const operations = [...syncQueue]
  syncQueue.length = 0 // Clear the queue
  
  for (const operation of operations) {
    try {
      await operation()
    } catch (error) {
      console.error('Failed to process queued sync operation:', error)
      // Re-queue the operation for later
      syncQueue.push(operation)
    }
  }
  
  if (syncQueue.length > 0) {
    console.log(`${syncQueue.length} operations still pending retry`)
  }
}

// Upsert media to Supabase
export async function upsertMedia(media: {
  id: string;
  lotId: string;
  kind: 'photo' | 'audio';
  r2Key: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  indexInLot: number;
}): Promise<void> {
  const operation = async () => {
    const { error } = await supabase
      .from('media')
      .upsert({
        id: media.id,
        lot_id: media.lotId,
        kind: media.kind,
        r2_key: media.r2Key,
        bytes: media.bytes,
        width: media.width,
        height: media.height,
        duration: media.duration,
        index_in_lot: media.indexInLot,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (error) {
      throw new Error(`Failed to sync media: ${error.message}`)
    }
  }

  const result = await withRetry(operation, `upsertMedia(${media.id})`)
  
  if (result === null) {
    // Add to retry queue
    syncQueue.push(() => upsertMedia(media))
    notifyToast(`Failed to sync media ${media.id}. Will retry later.`, 'error')
  } else {
    console.log(`Successfully synced media: ${media.id} (${media.kind})`)
  }
}

// Process pending media syncs from local database
export async function processPendingMediaSyncs(): Promise<void> {
  try {
    const { db } = await import('../db')
    
    // Find all media items that need sync
    const pendingMedia = await db.media.filter(media => media.needsSync === true).toArray()
    
    if (pendingMedia.length === 0) {
      return
    }
    
    console.log(`Processing ${pendingMedia.length} pending media syncs...`)
    
    for (const media of pendingMedia) {
      try {
        // Get the lot to access lot number
        const lot = await db.lots.get(media.lotId)
        if (!lot) {
          console.warn(`Lot not found for media ${media.id}`)
          continue
        }
        
        // Determine media kind
        const kind: 'photo' | 'audio' = media.type === 'photo' ? 'photo' : 'audio'
        
        // Get media metadata
        const mediaData = {
          id: media.id,
          lotId: media.lotId,
          kind,
          r2Key: media.remotePath || `Lot-${lot.number}/${media.type}/${media.id}`,
          bytes: media.bytes || 0,
          width: media.width,
          height: media.height,
          duration: media.duration,
          indexInLot: media.index
        }
        
        // Attempt to sync
        await upsertMedia(mediaData)
        
        // Mark as synced
        await db.media.update(media.id, { needsSync: false })
        
      } catch (error) {
        console.error(`Failed to sync media ${media.id}:`, error)
        // Keep needsSync flag for retry later
      }
    }
    
  } catch (error) {
    console.error('Error processing pending media syncs:', error)
  }
}

// Get queue status
export function getSyncQueueStatus(): { pending: number } {
  return { pending: syncQueue.length }
}
