'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { CheckCircle, XCircle, AlertCircle, User, Database, RefreshCw } from 'lucide-react'

interface QueryResult {
  success: boolean
  data?: any[]
  error?: string
  count?: number
}

export default function SupabaseHealthPage() {
  const { user, session } = useAuth()
  const [auctionResult, setAuctionResult] = useState<QueryResult | null>(null)
  const [lotResult, setLotResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState<{ auctions: boolean; lots: boolean }>({
    auctions: false,
    lots: false
  })

  const isDev = process.env.NODE_ENV !== 'production'
  
  // Check environment variables safely
  const [envStatus, setEnvStatus] = useState({ hasUrl: false, hasKey: false })
  
  useEffect(() => {
    try {
      // Direct process.env reads for client components
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
      
      setEnvStatus({
        hasUrl: !!url,
        hasKey: !!key
      })
    } catch (error) {
      console.error('Failed to get public env:', error)
      setEnvStatus({ hasUrl: false, hasKey: false })
    }
  }, [])

  // Mask user ID for display
  const maskedUserId = user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : null

  const testAuctions = async () => {
    setLoading(prev => ({ ...prev, auctions: true }))
    setAuctionResult(null)

    try {
      const { data, error, count } = await supabase
        .from('auctions')
        .select('id, name, archived', { count: 'exact' })
        .limit(5)

      if (error) {
        setAuctionResult({
          success: false,
          error: error.message
        })
      } else {
        setAuctionResult({
          success: true,
          data: data || [],
          count: count || 0
        })
      }
    } catch (error) {
      setAuctionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(prev => ({ ...prev, auctions: false }))
    }
  }

  const testLots = async () => {
    setLoading(prev => ({ ...prev, lots: true }))
    setLotResult(null)

    try {
      const { data, error, count } = await supabase
        .from('lots')
        .select('id, number, status, auction_id')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        setLotResult({
          success: false,
          error: error.message
        })
      } else {
        setLotResult({
          success: true,
          data: data || [],
          count: count || 0
        })
      }
    } catch (error) {
      setLotResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(prev => ({ ...prev, lots: false }))
    }
  }

  // Don't render in production
  if (!isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">This page is only available in development mode.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
            <Database className="w-8 h-8 mr-3" />
            Supabase Health Check
          </h1>
          <p className="text-gray-400">Development-only connectivity and query testing</p>
        </div>

        {/* Environment Variables */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Environment Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              {envStatus.hasUrl ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-white">NEXT_PUBLIC_SUPABASE_URL</span>
              <span className={`text-sm px-2 py-1 rounded ${
                envStatus.hasUrl ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {envStatus.hasUrl ? 'Present' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {envStatus.hasKey ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              <span className={`text-sm px-2 py-1 rounded ${
                envStatus.hasKey ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {envStatus.hasKey ? 'Present' : 'Missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Session Information */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Session Information
          </h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {session ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-white">Authentication Status</span>
              <span className={`text-sm px-2 py-1 rounded ${
                session ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {session ? 'Authenticated' : 'Not Authenticated'}
              </span>
            </div>
            {maskedUserId && (
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-blue-500" />
                <span className="text-white">User ID</span>
                <span className="text-sm px-2 py-1 rounded bg-blue-900 text-blue-300 font-mono">
                  {maskedUserId}
                </span>
              </div>
            )}
            {user?.email && (
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-blue-500" />
                <span className="text-white">Email</span>
                <span className="text-sm px-2 py-1 rounded bg-blue-900 text-blue-300">
                  {user.email}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Query Testing */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2" />
            Query Testing
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Auctions Test */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Auctions Query</h3>
                <button
                  onClick={testAuctions}
                  disabled={loading.auctions || !session}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading.auctions ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>List my auctions</span>
                </button>
              </div>
              
              {auctionResult && (
                <div className={`p-4 rounded-lg ${
                  auctionResult.success ? 'bg-green-900/20 border border-green-500' : 'bg-red-900/20 border border-red-500'
                }`}>
                  {auctionResult.success ? (
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-300 font-medium">
                          Success ({auctionResult.count} total auctions)
                        </span>
                      </div>
                      {auctionResult.data && auctionResult.data.length > 0 ? (
                        <div className="space-y-2">
                          {auctionResult.data.map((auction: any) => (
                            <div key={auction.id} className="bg-gray-700 p-3 rounded text-sm">
                              <div className="font-mono text-blue-300">{auction.id}</div>
                              <div className="text-white">{auction.name}</div>
                              <div className="text-gray-400">
                                Archived: {auction.archived ? 'Yes' : 'No'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400">No auctions found</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-red-300">Error: {auctionResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lots Test */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Lots Query</h3>
                <button
                  onClick={testLots}
                  disabled={loading.lots || !session}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading.lots ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>List latest lots</span>
                </button>
              </div>
              
              {lotResult && (
                <div className={`p-4 rounded-lg ${
                  lotResult.success ? 'bg-green-900/20 border border-green-500' : 'bg-red-900/20 border border-red-500'
                }`}>
                  {lotResult.success ? (
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-300 font-medium">
                          Success ({lotResult.count} total lots)
                        </span>
                      </div>
                      {lotResult.data && lotResult.data.length > 0 ? (
                        <div className="space-y-2">
                          {lotResult.data.map((lot: any) => (
                            <div key={lot.id} className="bg-gray-700 p-3 rounded text-sm">
                              <div className="font-mono text-blue-300">{lot.id}</div>
                              <div className="text-white">#{lot.number}</div>
                              <div className="text-gray-400">
                                Status: {lot.status} | Auction: {lot.auction_id}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400">No lots found</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-red-300">Error: {lotResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {!session && (
            <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span className="text-yellow-300">
                  Please sign in to test database queries
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
