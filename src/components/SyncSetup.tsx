'use client'

import { useEffect } from 'react'
import { setSyncToastHandler } from '@/src/lib/sync/state'
import { useToast } from '@/src/contexts/ToastContext'

export default function SyncSetup() {
  const { showToast } = useToast()

  useEffect(() => {
    // Set up the sync toast handler
    setSyncToastHandler(showToast)
  }, [showToast])

  return null // This component doesn't render anything
}
