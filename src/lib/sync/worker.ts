import { useSyncStore, shouldRetry } from './state'

// Exponential backoff configuration
const BASE_DELAY = 2000 // 2 seconds
const BACKOFF_MULTIPLIER = 1.7
const MAX_DELAY = 600000 // 10 minutes
const JITTER_MAX = 400 // 400ms jitter

interface QueuedOperation {
  id: string
  operation: () => Promise<void>
  attempts: number
  nextRetry: number
}

class SyncWorker {
  private queue: Map<string, QueuedOperation> = new Map()
  private isProcessing = false
  private processInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startProcessing()
  }

  // Add operation to queue
  addOperation(id: string, operation: () => Promise<void>) {
    const queuedOp: QueuedOperation = {
      id,
      operation,
      attempts: 0,
      nextRetry: Date.now()
    }
    
    this.queue.set(id, queuedOp)
    this.updateSyncState()
  }

  // Remove operation from queue
  removeOperation(id: string) {
    this.queue.delete(id)
    this.updateSyncState()
  }

  // Calculate delay with exponential backoff and jitter
  private calculateDelay(attempts: number): number {
    const exponentialDelay = BASE_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempts)
    const cappedDelay = Math.min(exponentialDelay, MAX_DELAY)
    const jitter = Math.random() * JITTER_MAX
    return cappedDelay + jitter
  }

  // Update sync state based on queue status
  private updateSyncState() {
    const pendingCount = this.queue.size
    const store = useSyncStore.getState()
    
    if (pendingCount === 0) {
      store.updateSyncUI('idle', 0)
    } else if (this.isProcessing) {
      store.updateSyncUI('syncing', pendingCount)
    } else {
      store.updateSyncUI('error', pendingCount, 'Some items will retry automatically')
    }
  }

  // Process the queue
  private async processQueue() {
    if (this.isProcessing || this.queue.size === 0) {
      return
    }

    // Check if we should retry (not recording and online)
    if (!shouldRetry()) {
      return
    }

    this.isProcessing = true
    this.updateSyncState()

    const now = Date.now()
    const readyOperations: QueuedOperation[] = []

    // Find operations ready for retry
    for (const operation of this.queue.values()) {
      if (operation.nextRetry <= now) {
        readyOperations.push(operation)
      }
    }

    // Process ready operations
    for (const operation of readyOperations) {
      try {
        await operation.operation()
        // Success - remove from queue
        this.queue.delete(operation.id)
        console.log(`✅ Sync operation ${operation.id} completed successfully`)
      } catch (error) {
        // Failed - schedule retry
        operation.attempts++
        operation.nextRetry = now + this.calculateDelay(operation.attempts)
        
        console.warn(`❌ Sync operation ${operation.id} failed (attempt ${operation.attempts}):`, error)
        
        // Remove if max attempts reached (optional - you can set a max)
        if (operation.attempts >= 10) {
          this.queue.delete(operation.id)
          console.error(`🚫 Sync operation ${operation.id} exceeded max attempts, removing from queue`)
        }
      }
    }

    this.isProcessing = false
    this.updateSyncState()
  }

  // Start the processing loop
  private startProcessing() {
    // Process every 5 seconds
    this.processInterval = setInterval(() => {
      this.processQueue()
    }, 5000)

    // Also process on online event
    window.addEventListener('online', () => {
      this.processQueue()
    })
  }

  // Stop the processing loop
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
    }
  }

  // Get queue status
  getStatus() {
    return {
      pending: this.queue.size,
      isProcessing: this.isProcessing,
      operations: Array.from(this.queue.values()).map(op => ({
        id: op.id,
        attempts: op.attempts,
        nextRetry: new Date(op.nextRetry)
      }))
    }
  }
}

// Global sync worker instance
export const syncWorker = new SyncWorker()

// Helper functions for common operations
export function queueSyncOperation(id: string, operation: () => Promise<void>) {
  syncWorker.addOperation(id, operation)
}

export function removeSyncOperation(id: string) {
  syncWorker.removeOperation(id)
}

export function getSyncWorkerStatus() {
  return syncWorker.getStatus()
}
