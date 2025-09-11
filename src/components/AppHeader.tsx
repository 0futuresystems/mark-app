'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getSyncQueueStatus } from '@/lib/supabaseSync'
import { Menu, X, RefreshCw, Plus, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function AppHeader() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [syncStatus, setSyncStatus] = useState({ pending: 0 })
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check sync status every 10 seconds
    const interval = setInterval(() => {
      setSyncStatus(getSyncQueueStatus())
    }, 10000)
    
    // Check immediately
    setSyncStatus(getSyncQueueStatus())
    
    return () => clearInterval(interval)
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
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
    setIsMenuOpen(false)
    await signOut()
    router.push('/auth')
  }

  const handleSync = () => {
    setIsMenuOpen(false)
    // TODO: Implement sync functionality
    console.log('Manual sync triggered')
  }

  const handleNewAuction = () => {
    setIsMenuOpen(false)
    router.push('/auctions')
  }

  const handleHomeClick = () => {
    router.push('/')
  }

  // Add haptic feedback for button presses
  const addHapticFeedback = () => {
    if (navigator.vibrate) {
      navigator.vibrate(30)
    }
  }

  return (
    <header className="flex justify-between items-center py-4 px-5 border-b border-brand-border bg-brand-bg">
      {/* App Title - Vintage styled and clickable */}
      <Link 
        href="/"
        onClick={() => {
          addHapticFeedback()
          handleHomeClick()
        }}
        className="transform transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <h1 className="text-2xl font-bold text-brand-text tracking-wide" 
            style={{ 
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
              letterSpacing: '0.5px'
            }}>
          Lot Logger
        </h1>
      </Link>
      
      {/* Right side with sync status and hamburger menu */}
      <div className="flex items-center space-x-4">
        {/* Sync Status Indicator - Changed to red for visibility */}
        {syncStatus.pending > 0 && (
          <span className="text-sm text-red-600 bg-red-100 px-3 py-1 rounded-full font-medium">
            {syncStatus.pending} pending sync
          </span>
        )}
        
        {/* Avatar Circle */}
        <div className="w-10 h-10 bg-brand-accent rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft">
          {getInitials(user.email || '')}
        </div>
        
        {/* Hamburger Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              addHapticFeedback()
              setIsMenuOpen(!isMenuOpen)
            }}
            className="w-12 h-12 bg-brand-panel rounded-xl flex items-center justify-center hover:bg-brand-border transition-all duration-150 transform hover:scale-105 active:scale-95 shadow-soft"
            aria-label="Menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-brand-text" />
            ) : (
              <Menu className="w-6 h-6 text-brand-text" />
            )}
          </button>
          
          {/* Menu Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-3 w-56 bg-brand-panel border border-brand-border rounded-2xl shadow-medium z-50 overflow-hidden">
              {/* New Auction */}
              <button
                onClick={() => {
                  addHapticFeedback()
                  handleNewAuction()
                }}
                className="w-full flex items-center space-x-3 px-4 py-4 text-left hover:bg-brand-bg transition-all duration-150 transform hover:scale-[1.02] border-b border-brand-border"
              >
                <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-medium text-brand-text">New Auction</p>
                  <p className="text-sm text-brand-text-muted">Create a new auction</p>
                </div>
              </button>
              
              {/* Sync */}
              <button
                onClick={() => {
                  addHapticFeedback()
                  handleSync()
                }}
                className="w-full flex items-center space-x-3 px-4 py-4 text-left hover:bg-brand-bg transition-all duration-150 transform hover:scale-[1.02] border-b border-brand-border"
              >
                <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-medium text-brand-text">Sync</p>
                  <p className="text-sm text-brand-text-muted">Upload pending data</p>
                </div>
              </button>
              
              {/* Sign Out */}
              <button
                onClick={() => {
                  addHapticFeedback()
                  handleSignOut()
                }}
                className="w-full flex items-center space-x-3 px-4 py-4 text-left hover:bg-brand-bg transition-all duration-150 transform hover:scale-[1.02]"
              >
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-medium text-brand-text">Sign Out</p>
                  <p className="text-sm text-brand-text-muted">End your session</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
