'use client'

import { useEffect } from 'react'
import { setSyncToastHandler, processSyncQueue, processPendingMediaSyncs } from '@/src/lib/supabaseSync'
import { useToast } from '@/src/contexts/ToastContext'

export default function SyncSetup() {
  const { showToast } = useToast()

  useEffect(() => {
    // Set up the sync toast handler
    setSyncToastHandler(showToast)
    
    // Process sync queue every 30 seconds
    const interval = setInterval(() => {
      processSyncQueue()
      processPendingMediaSyncs()
    }, 30000)
    
    // Also process on page focus (when user comes back to the app)
    const handleFocus = () => {
      processSyncQueue()
      processPendingMediaSyncs()
    }
    
    // Process on online event
    const handleOnline = () => {
      processSyncQueue()
      processPendingMediaSyncs()
    }
    
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [showToast])

  return null // This component doesn't render anything
}
