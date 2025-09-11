'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/src/lib/supabaseClient'
import { useAuth } from '@/src/contexts/AuthContext'
import { useToast } from '@/src/contexts/ToastContext'
import { useRouter } from 'next/navigation'
import { AlertTriangle, KeyRound, CheckCircle } from 'lucide-react'
import AuthCard, { AuthCardHeader, AuthCardForm, AuthCardInput, AuthCardButton, AuthCardFooter } from '@/src/components/AuthCard'

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
          shouldCreateUser: false
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AuthCard>
        <AuthCardHeader
          title="Sign in"
          subtitle={step === 'email' ? "We'll email you a login code." : "Enter the 6-digit code we sent to your email."}
        />

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
          <AuthCardForm onSubmit={handleSendCode}>
            <AuthCardInput
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoComplete="email"
            />

            <AuthCardButton
              type="submit"
              disabled={loading || !email.trim()}
              loading={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  <span>Send code</span>
                </>
              )}
            </AuthCardButton>
          </AuthCardForm>
        )}

        {/* Code Step */}
        {step === 'code' && (
          <AuthCardForm onSubmit={handleVerifyCode}>
            <AuthCardInput
              id="code"
              name="code"
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={loading}
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              className="text-2xl text-center tracking-widest font-mono"
            />

            <AuthCardButton
              type="submit"
              disabled={loading || code.length !== 6}
              loading={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Verify</span>
                </>
              )}
            </AuthCardButton>

            {/* Back to email */}
            <AuthCardFooter>
              <button
                type="button"
                onClick={handleBackToEmail}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                ← Back to email
              </button>
            </AuthCardFooter>
          </AuthCardForm>
        )}

        {/* Help Text */}
        <AuthCardFooter>
          <p className="text-xs text-muted-foreground">
            No password required • Secure OTP authentication
          </p>
        </AuthCardFooter>
      </AuthCard>
    </div>
  )
}
