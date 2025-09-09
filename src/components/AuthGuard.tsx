'use client'

import { useAuth } from '@/src/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Only enforce auth in production
    if (process.env.NODE_ENV === 'production' && !loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // In development, always show children (bypass auth)
  if (process.env.NODE_ENV === 'development') {
    return <>{children}</>
  }

  // In production, only show children if authenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to /auth
  }

  return <>{children}</>
}
