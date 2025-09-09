# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Lot Logger is a Next.js Progressive Web App (PWA) specifically optimized for iPhone Home-Screen use. It's designed for efficient lot tracking and logging with offline-first capabilities, using IndexedDB for local storage and providing data export functionality.

## Key Technologies
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode enabled
- **Database**: Dexie (IndexedDB wrapper) for offline storage
- **Validation**: Zod for type-safe data validation
- **Styling**: Tailwind CSS with custom brand colors and responsive design
- **PWA**: Service worker with offline capabilities and mobile optimization

## Development Commands

### Core Development
```bash
npm install          # Install dependencies
npm run dev         # Start development server on localhost:3000
npm run build       # Create production build
npm start           # Start production server
npm run lint        # Run ESLint
```

### Testing Individual Components
The app includes specialized test pages for development:
- `/test-setup` - Test camera and microphone permissions
- `/test-verification` - Verify media capture functionality
- `/debug` - Debug database and local storage state

## Architecture Overview

### Database Schema (Dexie/IndexedDB)
The app uses a local-first architecture with four main tables:
- **auctions**: Auction management with auto-migration from v1 to v2
- **lots**: Individual lot entries linked to auctions
- **media**: Media metadata (photos, voice recordings) with upload tracking
- **blobs**: Binary data storage for media files
- **meta**: Key-value store for app metadata

### Key Data Flow
1. **Media Capture**: Photos via `CameraCapture`/`MultiShotCamera`, audio via `AudioRecorder`
2. **Local Storage**: Media blobs stored in IndexedDB via `blobStore.ts`
3. **Upload Queue**: Managed by `uploadQueue.ts` with retry logic and progress tracking
4. **Data Export**: JSZip integration for bundling and export

### Component Architecture
- **Page Routes**: App Router structure under `/app` directory
- **Reusable Components**: Located in `/src/components/`
  - `AuctionSelector`: Dropdown for auction management
  - `CameraCapture`/`MultiShotCamera`: Photo capture interfaces  
  - `AudioRecorder`/`AudioPlayer`: Voice recording functionality
  - `QuickOverview`: Dashboard statistics display
- **Utilities**: Helper functions in `/src/lib/`
  - `blobStore.ts`: Binary data management
  - `uploadQueue.ts`: Upload synchronization with progress tracking
  - `csv.ts`: Data export utilities
  - `permissions.ts`: Camera/microphone permission handling

### PWA Configuration
- **Manifest**: `public/manifest.json` for home screen installation
- **Service Worker**: `public/sw.js` for offline functionality
- **App Shell**: Configured in `app/layout.tsx` with mobile-optimized meta tags

## Database Migrations
The app includes automatic migration from v1 (single auction) to v2 (multiple auctions). When working with database schema changes, update the migration logic in `src/db.ts`.

## Development Notes

### Media Handling
- Photos and audio are stored as binary blobs in IndexedDB
- Media items track upload status and remote paths
- Upload queue supports retry logic and offline detection

### Mobile Optimization
- Tailwind config includes mobile-first responsive breakpoints
- Custom brand colors (`brand.bg: #0b132b`, `brand.panel: #0e1117`)
- iPhone-specific PWA meta tags and home screen optimization

### Offline-First Design
- All core functionality works without internet connection
- Data syncs when connection is available via upload queue
- Service worker handles caching and offline resources

### Type Safety
- Strict TypeScript configuration with comprehensive type definitions
- Zod schemas for runtime validation
- Custom types defined in `src/types.ts`

## File Structure Context
```
app/                 # Next.js App Router pages
├── new/            # New lot entry workflow
├── review/         # Data review and management
├── send/           # Upload and sync functionality
└── debug/          # Development debugging tools

src/
├── components/     # Reusable UI components
├── lib/           # Utility functions and helpers
├── db.ts          # Database configuration and migrations
└── types.ts       # TypeScript type definitions

public/
├── manifest.json  # PWA manifest
└── sw.js         # Service worker
```
