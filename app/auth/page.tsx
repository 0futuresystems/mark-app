'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRouter } from 'next/navigation'
import { Mail, ArrowRight, AlertTriangle, KeyRound, CheckCircle } from 'lucide-react'

type AuthStep = 'email' | 'code'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<AuthStep>('email')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()


  // Load last used email from localStorage
  useEffect(() => {
    const lastEmail = localStorage.getItem('lot-logger-last-email')
    if (lastEmail) {
      setEmail(lastEmail)
    }
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!isSupabaseConfigured()) {
        showToast('Authentication service is not configured. Please contact support.', 'error')
        return
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true
        }
      })

      if (error) {
        showToast(`Failed to send code: ${error.message}`, 'error')
      } else {
        // Store email in localStorage
        localStorage.setItem('lot-logger-last-email', email)
        setCodeSent(true)
        setStep('code')
        showToast('We\'ve sent a 6-digit code to your email.', 'success')
      }
    } catch (error) {
      showToast(`Failed to send code: ${error}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      })

      if (error) {
        showToast(`Invalid code: ${error.message}`, 'error')
      } else {
        showToast('Signed in', 'success')
        router.push('/')
      }
    } catch (error) {
      showToast(`Verification failed: ${error}`, 'error')
    } finally {
      setLoading(false)
    }
  }


  const handleBackToEmail = () => {
    setStep('email')
    setCode('')
    setCodeSent(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Sign in
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {step === 'email' ? "We'll email you a login code." : "Enter the 6-digit code we sent to your email."}
          </p>
        </div>

        {/* Configuration Warning */}
        {!isSupabaseConfigured() && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
              <span className="text-yellow-800 dark:text-yellow-300">Authentication service not configured</span>
            </div>
            <div className="mt-1 text-yellow-700 dark:text-yellow-200 text-xs">
              Please contact support to enable login functionality
            </div>
          </div>
        )}

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-4 text-lg bg-white text-gray-900 placeholder:text-gray-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 border border-gray-300 dark:border-gray-600 rounded-xl transition-all"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center space-x-2 py-4 px-6 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  <span>Send code</span>
                </>
              )}
            </button>

          </form>
        )}

        {/* Code Step */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                6-digit code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className="w-full px-4 py-4 text-2xl text-center tracking-widest bg-white text-gray-900 placeholder:text-gray-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 border border-gray-300 dark:border-gray-600 rounded-xl transition-all font-mono"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full flex items-center justify-center space-x-2 py-4 px-6 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Verify</span>
                </>
              )}
            </button>

            {/* Back to email */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToEmail}
                disabled={loading}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
              >
                ← Back to email
              </button>
            </div>
          </form>
        )}

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No password required • Secure OTP authentication
          </p>
        </div>
      </div>
    </div>
  )
}
