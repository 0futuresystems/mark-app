import { create } from 'zustand'

export type SyncState = 'idle' | 'syncing' | 'error'

interface SyncStore {
  state: SyncState
  pendingCount: number
  lastError: string | null
  isMediaRecorderActive: boolean
  updateSyncUI: (state: SyncState, pendingCount: number, error?: string) => void
  setMediaRecorderActive: (active: boolean) => void
}

// Toast handler that will be set by the app
let showToast: ((message: string, type: 'success' | 'error') => void) | null = null

export function setSyncToastHandler(handler: (message: string, type: 'success' | 'error') => void) {
  showToast = handler
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  state: 'idle',
  pendingCount: 0,
  lastError: null,
  isMediaRecorderActive: false,
  
  updateSyncUI: (state: SyncState, pendingCount: number, error?: string) => {
    const currentState = get().state
    
    set({ 
      state, 
      pendingCount,
      lastError: error || null
    })
    
    // Only show toast when transitioning TO error state (not when already in error)
    if (state === 'error' && currentState !== 'error' && showToast) {
      showToast('Some items will retry automatically', 'error')
    }
  },
  
  setMediaRecorderActive: (active: boolean) => {
    set({ isMediaRecorderActive: active })
  }
}))

// Helper to get current sync state
export function getSyncState(): { state: SyncState; pendingCount: number; lastError: string | null } {
  const store = useSyncStore.getState()
  return {
    state: store.state,
    pendingCount: store.pendingCount,
    lastError: store.lastError
  }
}

// Helper to check if we should retry (not recording and online)
export function shouldRetry(): boolean {
  const store = useSyncStore.getState()
  return !store.isMediaRecorderActive && navigator.onLine
}
