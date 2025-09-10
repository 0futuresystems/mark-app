'use client'

import { useAuth } from '@/src/contexts/AuthContext'
import Link from 'next/link'
import { LogIn, ArrowRight } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()

  // While checking session: render a small centered spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If session exists: render children
  if (user) {
    return <>{children}</>
  }

  // If no session: render a friendly sign-in panel for protected routes
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-8 h-8 text-blue-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            You need to sign in
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Please sign in to access your lot tracking dashboard
          </p>
          
          <Link 
            href="/auth"
            className="inline-flex items-center justify-center space-x-2 w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          >
            <span>Go to Sign in</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
            Secure OTP authentication • No password required
          </p>
        </div>
      </div>
    </div>
  )
}
