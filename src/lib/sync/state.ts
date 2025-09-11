'use client'

import { create } from 'zustand'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  syncError: string | null
  pendingUploads: number
  setOnline: (online: boolean) => void
  setSyncing: (syncing: boolean) => void
  setLastSyncTime: (time: Date | null) => void
  setSyncError: (error: string | null) => void
  setPendingUploads: (count: number) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  pendingUploads: 0,
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setSyncError: (error) => set({ syncError: error }),
  setPendingUploads: (count) => set({ pendingUploads: count }),
}))
