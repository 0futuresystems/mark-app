# Lot Logger

A minimal Next.js PWA (Progressive Web App) designed for iPhone Home-Screen use. This application provides a streamlined interface for logging and tracking lot information with offline capabilities.

## Features

- **PWA Support**: Optimized for iPhone Home-Screen installation
- **Offline-First**: Built with IndexedDB (Dexie) for local data storage
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Data Export**: JSZip integration for data compression and export
- **Responsive Design**: Mobile-first approach for optimal iPhone experience

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: Dexie (IndexedDB wrapper)
- **Validation**: Zod
- **Compression**: JSZip
- **Linting**: ESLint

## Auth (OTP)

This application uses OTP-only authentication with Supabase:

- **Dashboard template must exclude `{{ .ActionLink }}` and include only `{{ .Token }}`**
- **Public signups disabled. Use `options.shouldCreateUser=false`**
- No magic links or redirects - users enter code directly in the app
- Invite-only system - only pre-registered emails can sign in

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## PWA Installation

To install on iPhone:
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will appear as a native-like experience

## Offline Test

To verify offline functionality:

1. **Build and start the production server:**
   ```bash
   npm run build
   npm start
   ```

2. **Open Chrome DevTools:**
   - Go to Application → Service Workers
   - Verify SW is registered and controlling
   - Check Cache Storage for populated caches

3. **Test offline behavior:**
   - Navigate to different pages to populate cache
   - Toggle "Offline" in DevTools Network tab
   - Reload the page - should show app shell or offline page
   - Visit cached pages - should load from cache
   - Navigate to uncached pages - should show offline fallback

4. **Verify PWA assets:**
   - `/manifest.json` loads without auth
   - `/sw.js` loads without auth
   - `/~offline` page displays properly
   - Icons and static assets are accessible

## Purpose

This app is designed for efficient lot tracking and logging, providing a native app-like experience when installed on iPhone home screens while maintaining full offline functionality.