'use client'

import { useSyncStore } from '@/lib/sync/state'
import { useEffect } from 'react'

export default function SyncBanner() {
  const { 
    isOnline, 
    isSyncing, 
    lastSyncTime, 
    syncError, 
    pendingUploads,
    setOnline 
  } = useSyncStore()

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  if (!isOnline) {
    return (
      <div className="bg-yellow-500 text-white px-4 py-2 text-center text-sm">
        You're offline. Changes will sync when connection is restored.
      </div>
    )
  }

  if (syncError) {
    return (
      <div className="bg-red-500 text-white px-4 py-2 text-center text-sm">
        Sync error: {syncError}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="bg-blue-500 text-white px-4 py-2 text-center text-sm">
        Syncing data...
      </div>
    )
  }

  if (pendingUploads > 0) {
    return (
      <div className="bg-orange-500 text-white px-4 py-2 text-center text-sm">
        {pendingUploads} items pending upload
      </div>
    )
  }

  if (lastSyncTime) {
    return (
      <div className="bg-green-500 text-white px-4 py-2 text-center text-sm">
        Last synced: {lastSyncTime.toLocaleTimeString()}
      </div>
    )
  }

  return null
}
