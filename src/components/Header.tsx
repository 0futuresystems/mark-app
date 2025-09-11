'use client'

import { useEffect } from 'react'
import { useAuth } from '@/src/contexts/AuthContext'
import { useSyncStore } from '@/src/lib/sync/state'
import { getSyncQueueStatus } from '@/src/lib/supabaseSync'

export default function Header() {
  const { user, signOut } = useAuth()
  const { pendingUploads, setPendingUploads } = useSyncStore()

  useEffect(() => {
    // Check sync status every 10 seconds
    const interval = setInterval(() => {
      const status = getSyncQueueStatus()
      setPendingUploads(status.pending)
    }, 10000)
    
    // Check immediately
    const status = getSyncQueueStatus()
    setPendingUploads(status.pending)
    
    return () => clearInterval(interval)
  }, [setPendingUploads])

  if (!user) {
    return null
  }

  return (
    <header className="flex justify-between items-center py-4 border-b border-gray-700">
      <h1 className="text-xl font-bold text-white">Lot Logger</h1>
      <div className="flex items-center space-x-4">
        {pendingUploads > 0 && (
          <span className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">
            {pendingUploads} pending sync
          </span>
        )}
        <span className="text-sm text-gray-400">
          {user.email}
        </span>
        <button
          onClick={signOut}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
