'use client'

import { useState, useEffect } from 'react'

export default function EnvDebugPage() {
  const [envData, setEnvData] = useState<{
    url: string
    key: string
    hasUrl: boolean
    hasKey: boolean
  } | null>(null)

  const isDev = process.env.NODE_ENV === 'production'

  useEffect(() => {
    if (isDev) return

    try {
      // Direct process.env reads for client components
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
      
      setEnvData({
        url,
        key,
        hasUrl: !!url,
        hasKey: !!key
      })
    } catch (error) {
      console.error('Failed to get env:', error)
      setEnvData({
        url: '',
        key: '',
        hasUrl: false,
        hasKey: false
      })
    }
  }, [isDev])

  // Don't render in production
  if (isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">This page is only available in development mode.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gray-900">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Environment Debug</h1>
        
        {envData ? (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-white mb-3">NEXT_PUBLIC_SUPABASE_URL</h2>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${envData.hasUrl ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-white">{envData.hasUrl ? 'Present' : 'Missing'}</span>
                </div>
                {envData.hasUrl && (
                  <div className="text-sm text-gray-300 font-mono bg-gray-700 p-2 rounded">
                    {envData.url.slice(0, 20)}...{envData.url.slice(-10)}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-white mb-3">NEXT_PUBLIC_SUPABASE_ANON_KEY</h2>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${envData.hasKey ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-white">{envData.hasKey ? 'Present' : 'Missing'}</span>
                </div>
                {envData.hasKey && (
                  <div className="text-sm text-gray-300 font-mono bg-gray-700 p-2 rounded">
                    {envData.key.slice(0, 20)}...{envData.key.slice(-10)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400">Loading environment data...</div>
        )}
      </div>
    </div>
  )
}
