import { supabase } from './supabaseClient'
import { Auction, Lot, MediaItem } from '../types'

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_DELAY = 10000 // 10 seconds (increased to reduce frequency)
const MAX_DELAY = 300000 // 5 minutes
const TOAST_COOLDOWN = 30000 // 30 seconds between toast notifications

// Queue for failed sync operations
const syncQueue: Array<() => Promise<void>> = []

// Toast notification function (will be set by the app)
let showToast: ((message: string, type: 'success' | 'error') => void) | null = null

// Track last toast time to prevent spam
let lastToastTime = 0

export function setSyncToastHandler(handler: (message: string, type: 'success' | 'error') => void) {
  showToast = handler
}

// Helper function to show toast notifications with cooldown
function notifyToast(message: string, type: 'success' | 'error') {
  const now = Date.now()
  if (showToast && (now - lastToastTime > TOAST_COOLDOWN || type === 'success')) {
    showToast(message, type)
    lastToastTime = now
  } else if (!showToast) {
    console.log(`Toast: ${type.toUpperCase()} - ${message}`)
  }
}

// Helper function to categorize errors
function categorizeError(error: any): { shouldRetry: boolean; category: string; message: string } {
  const errorMessage = error?.message || error?.toString() || 'Unknown error'
  
  // Authentication/permission errors - don't retry
  if (errorMessage.includes('JWT') || 
      errorMessage.includes('unauthorized') || 
      errorMessage.includes('permission') ||
      errorMessage.includes('auth') ||
      error?.status === 401 ||
      error?.status === 403) {
    return {
      shouldRetry: false,
      category: 'authentication',
      message: 'Authentication or permission error - not retrying'
    }
  }
  
  // Network errors - retry
  if (errorMessage.includes('network') || 
      errorMessage.includes('timeout') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch') ||
      error?.code === 'NETWORK_ERROR' ||
      error?.status >= 500) {
    return {
      shouldRetry: true,
      category: 'network',
      message: 'Network error - will retry'
    }
  }
  
  // Data validation errors - don't retry
  if (errorMessage.includes('validation') || 
      errorMessage.includes('constraint') ||
      errorMessage.includes('duplicate') ||
      error?.status === 400 ||
      error?.status === 422) {
    return {
      shouldRetry: false,
      category: 'data',
      message: 'Data validation error - not retrying'
    }
  }
  
  // Default to retry for unknown errors
  return {
    shouldRetry: true,
    category: 'unknown',
    message: 'Unknown error - will retry'
  }
}

// Helper function to retry operations with exponential backoff
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
      const errorInfo = categorizeError(error)
      
      console.warn(`${operationName} attempt ${attempt} failed:`, {
        error: errorInfo.message,
        category: errorInfo.category,
        originalError: error
      })
      
      // Don't retry if error category indicates we shouldn't
      if (!errorInfo.shouldRetry) {
        console.error(`${operationName} failed with non-retryable error:`, errorInfo.message)
        return null
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff: Math.min(INITIAL_DELAY * Math.pow(2, attempt - 1), MAX_DELAY)
        const delay = Math.min(INITIAL_DELAY * Math.pow(2, attempt - 1), MAX_DELAY)
        console.log(`${operationName} retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
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
    console.warn(`🔄 Queued auction for retry: ${auction.id} - ${auction.name}`)
    notifyToast(`Failed to sync auction "${auction.name}". Will retry later.`, 'error')
  } else {
    console.log(`✅ Successfully synced auction: ${auction.id} - ${auction.name}`)
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
    console.warn(`🔄 Queued lot for retry: ${lot.id} - #${lot.number} (${lot.status})`)
    notifyToast(`Failed to sync lot #${lot.number}. Will retry later.`, 'error')
  } else {
    console.log(`✅ Successfully synced lot: ${lot.id} - #${lot.number} (${lot.status})`)
  }
}

// Process the retry queue
export async function processSyncQueue(): Promise<void> {
  if (syncQueue.length === 0) {
    console.log('Sync queue is empty - no operations to process')
    return
  }
  
  console.log(`🔄 Processing ${syncQueue.length} queued sync operations...`)
  const startTime = Date.now()
  
  const operations = [...syncQueue]
  syncQueue.length = 0 // Clear the queue
  
  let successCount = 0
  let failureCount = 0
  
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    try {
      console.log(`📤 Processing sync operation ${i + 1}/${operations.length}`)
      await operation()
      successCount++
      console.log(`✅ Sync operation ${i + 1} completed successfully`)
    } catch (error) {
      failureCount++
      console.error(`❌ Failed to process queued sync operation ${i + 1}:`, error)
      // Re-queue the operation for later
      syncQueue.push(operation)
    }
  }
  
  const duration = Date.now() - startTime
  console.log(`📊 Sync queue processing completed in ${duration}ms:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${failureCount}`)
  console.log(`   ⏳ Re-queued: ${syncQueue.length}`)
  
  if (syncQueue.length > 0) {
    console.warn(`⚠️  ${syncQueue.length} operations still pending retry`)
  } else {
    console.log('🎉 All sync operations completed successfully')
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
    console.warn(`🔄 Queued media for retry: ${media.id} (${media.kind})`)
    notifyToast(`Failed to sync media ${media.id}. Will retry later.`, 'error')
  } else {
    console.log(`✅ Successfully synced media: ${media.id} (${media.kind})`)
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
          bytes: media.bytesSize || 0,
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

// Get queue status with detailed information
export function getSyncQueueStatus(): { 
  pending: number; 
  isEmpty: boolean; 
  lastProcessed?: Date;
  status: 'idle' | 'processing' | 'has_pending';
} {
  return { 
    pending: syncQueue.length,
    isEmpty: syncQueue.length === 0,
    status: syncQueue.length === 0 ? 'idle' : 'has_pending'
  }
}

// Enhanced logging for sync operations
export function logSyncStatus(): void {
  const status = getSyncQueueStatus()
  console.log('📋 Sync Queue Status:', {
    pendingOperations: status.pending,
    isEmpty: status.isEmpty,
    status: status.status,
    timestamp: new Date().toISOString()
  })
}
