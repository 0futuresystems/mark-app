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

## Environment & Console Setup

### Environment Variables
Copy `.env.example` to `.env.local` and fill in the required values:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `R2_ACCOUNT_ID`: Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID`: Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY`: Cloudflare R2 secret key
- `R2_BUCKET`: R2 bucket name (default: mark-app)
- `RESEND_API_KEY`: Resend API key for email functionality

### Supabase Configuration
1. **Auth Email Template**: In Supabase Auth settings, update the "Confirm sign in" email template to show ONLY: `Your sign-in code: {{ .Token }}` (remove `{{ .ActionLink }}`)
2. **Public Signups**: Disable public signups in Supabase Auth settings
3. **Site URL**: Set Site URL to your Vercel domain in Supabase Auth settings

### Cloudflare R2 CORS Configuration
Configure R2 bucket CORS with:
- **AllowedOrigins**: Your Vercel URL + `http://localhost:3000`
- **Methods**: `GET, PUT, HEAD, OPTIONS`
- **Headers**: `*`
- **Expose**: `ETag, Content-Length`

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

## Purpose

This app is designed for efficient lot tracking and logging, providing a native app-like experience when installed on iPhone home screens while maintaining full offline functionality.