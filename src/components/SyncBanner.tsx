'use client'

import { useSyncStore } from '@/src/lib/sync/state'
import { CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react'

export default function SyncBanner() {
  const { state, pendingCount, lastError } = useSyncStore()

  // Don't show banner when idle and no pending items
  if (state === 'idle' && pendingCount === 0) {
    return null
  }

  const getBannerContent = () => {
    switch (state) {
      case 'syncing':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: `Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}…`,
          className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-500'
        }
      case 'error':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          text: 'Some items will retry…',
          className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-500'
        }
      case 'idle':
      default:
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'All synced',
          className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-500'
        }
    }
  }

  const content = getBannerContent()

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b ${content.className}`}>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-center space-x-2 text-sm font-medium">
          {content.icon}
          <span>{content.text}</span>
        </div>
      </div>
    </div>
  )
}
