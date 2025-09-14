'use client'

import { useEffect, useState } from 'react'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    setIsOnline(navigator.onLine)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-brand-text">
            {isOnline ? 'Connection Restored' : 'You\'re Offline'}
          </h1>
          <p className="text-sm opacity-70 text-brand-text">
            {isOnline 
              ? 'Your connection is back. You can now sync your data.'
              : 'The app shell is available. Any cached lots, photos, and notes will still show.'
            }
          </p>
        </div>
        
        <div className="space-y-3">
          <button
            className="w-full px-4 py-2 rounded-lg border border-brand-border bg-brand-surface text-brand-text hover:bg-brand-surface/80 transition-colors"
            onClick={() => location.reload()}
          >
            {isOnline ? 'Reload App' : 'Try Again'}
          </button>
          
          <button
            className="w-full px-4 py-2 rounded-lg border border-brand-border bg-transparent text-brand-text hover:bg-brand-surface/50 transition-colors"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
        
        {!isOnline && (
          <div className="text-xs opacity-50 text-brand-text">
            <p>• Cached pages will load instantly</p>
            <p>• New data will sync when online</p>
            <p>• Photos and notes are stored locally</p>
          </div>
        )}
      </div>
    </main>
  )
}
