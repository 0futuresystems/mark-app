'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/src/lib/supabaseClient'
import { useAuth } from '@/src/contexts/AuthContext'
import { useToast } from '@/src/contexts/ToastContext'
import { useRouter } from 'next/navigation'
import { Mail, ArrowRight, AlertTriangle } from 'lucide-react'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Check if Supabase is configured before attempting to use it
      if (!isSupabaseConfigured()) {
        showToast('Authentication service is not configured. Please contact support.', 'error')
        return
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        showToast(`Failed to send login link: ${error.message}`, 'error')
      } else {
        showToast('Check your email for the login link!', 'success')
      }
    } catch (error) {
      showToast(`Failed to send login link: ${error}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome to Lot Logger
          </h1>
          <p className="text-gray-400 text-sm">
            Enter your email to get started
          </p>
        </div>

        {/* Configuration Warning */}
        {!isSupabaseConfigured() && (
          <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-yellow-300">Authentication service not configured</span>
            </div>
            <div className="mt-1 text-yellow-200 text-xs">
              Please contact support to enable login functionality
            </div>
          </div>
        )}

        {/* Domain Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2 text-sm">
            <Mail className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300">Login link will be sent to:</span>
          </div>
          <div className="mt-1 text-white font-mono text-sm">
            {typeof window !== 'undefined' ? window.location.hostname : 'lot-logger.app'}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-4 py-4 text-lg border border-gray-600 placeholder-gray-400 text-white bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full flex items-center justify-center space-x-2 py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>Email me a login link</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            No password required • Secure magic link authentication
          </p>
        </div>
      </div>
    </div>
  )
}
