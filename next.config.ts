import type { NextConfig } from 'next'
import createNextPWA from '@ducanh2912/next-pwa'

const withPWA = createNextPWA({
  dest: 'public',
  // keep SW off in dev to avoid confusion
  disable: process.env.NODE_ENV === 'development',
  // cache navigations when user moves through the app
  cacheOnFrontEndNav: true,
  cacheStartUrl: true,
  dynamicStartUrl: true,
  // Offline fallback document for App Router:
  // next-pwa expects /~offline for App Router projects
  fallbacks: {
    document: '/~offline',
    // optional fallbacks (create the files below)
    data: '/fallback.json',
    image: '/fallback.webp'
  },
  // Workbox options to avoid caching APIs and to tune assets
  workboxOptions: {
    // extend defaults, don't replace them
    runtimeCaching: [
      // Never cache API routes (auth, uploads, presigned URLs, etc.)
      {
        urlPattern: ({url}) => url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
        method: 'GET'
      },
      // Images (local/public) — allow offline viewing of thumbs
      {
        urlPattern: ({request}) => request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }
        }
      },
      // Audio (voice notes) if served as files (skip if streamed)
      {
        urlPattern: ({request}) => request.destination === 'audio',
        handler: 'CacheFirst',
        options: {
          cacheName: 'audio',
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
        }
      }
    ]
  }
})

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure proper client/server component boundaries
  serverExternalPackages: ['dexie'],
  experimental: {
    // Help with client reference manifest generation
    optimizePackageImports: ['lucide-react'],
  },
  reactStrictMode: true,
  // Serve SW with correct headers (Next docs recommendation)
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }
        ]
      }
    ]
  }
}

export default withPWA(nextConfig)
