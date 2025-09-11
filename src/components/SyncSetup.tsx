'use client'

import { useEffect } from 'react'
// Disabled auto-sync - now using manual sync only on /send page
// import { setSyncToastHandler, processSyncQueue, processPendingMediaSyncs } from '@/lib/supabaseSync'
import { useToast } from '@/contexts/ToastContext'

export default function SyncSetup() {
  const { showToast } = useToast()

  useEffect(() => {
    // Auto-sync disabled - users must manually sync on /send page
    console.log('Auto-sync disabled - use /send page for manual sync')
    
    // No automatic processing - keeping app fully offline-first
  }, [showToast])

  return null // This component doesn't render anything
}
