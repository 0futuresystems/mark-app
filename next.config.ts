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
  // Security headers and SW configuration
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : "'self' 'unsafe-inline'";

    const securityHeaders = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: [
          "default-src 'self'",
          `script-src ${scriptSrc}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' blob: data:",
          "media-src 'self' blob:",
          "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com",
          "font-src 'self' data:",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ") },
    ];

    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }
        ]
      },
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ]
  }
}

export default withPWA(nextConfig)
