'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/contexts/AuthContext'
import { getSyncQueueStatus } from '@/src/lib/supabaseSync'
import { ChevronDown, LogOut, Mail } from 'lucide-react'

export default function AppHeader() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [syncStatus, setSyncStatus] = useState({ pending: 0 })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check sync status every 10 seconds
    const interval = setInterval(() => {
      setSyncStatus(getSyncQueueStatus())
    }, 10000)
    
    // Check immediately
    setSyncStatus(getSyncQueueStatus())
    
    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!user) {
    return null
  }

  // Generate initials from email
  const getInitials = (email: string) => {
    const parts = email.split('@')[0].split('.')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  // Truncate email for display
  const truncateEmail = (email: string, maxLength: number = 20) => {
    if (email.length <= maxLength) return email
    return email.substring(0, maxLength - 3) + '...'
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  return (
    <header className="flex justify-between items-center py-3 px-4 border-b border-gray-700 bg-brand-bg">
      {/* App Title */}
      <h1 className="text-lg font-semibold text-white">Lot Logger</h1>
      
      {/* Right side with sync status and avatar */}
      <div className="flex items-center space-x-3">
        {/* Sync Status Indicator */}
        {syncStatus.pending > 0 && (
          <span className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded-full">
            {syncStatus.pending} pending
          </span>
        )}
        
        {/* Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-800/50 transition-colors"
            aria-label="Account menu"
          >
            {/* Avatar Circle */}
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {getInitials(user.email || '')}
            </div>
            
            {/* Dropdown Arrow */}
            <ChevronDown 
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`} 
            />
          </button>
          
          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-brand-panel border border-gray-700 rounded-lg shadow-soft z-50">
              <div className="p-3 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                    {getInitials(user.email || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {truncateEmail(user.email || '')}
                    </p>
                    <p className="text-xs text-gray-400">Account</p>
                  </div>
                </div>
              </div>
              
              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
