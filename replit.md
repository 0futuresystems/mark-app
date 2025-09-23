# Overview

Lot Logger is a Next.js Progressive Web App (PWA) specifically optimized for iPhone Home-Screen use. It provides an offline-first solution for auction lot tracking and logging with comprehensive media capture capabilities. The application uses a local-first architecture with IndexedDB for primary storage, allowing users to work completely offline and sync data to the cloud when connectivity is available.

The app features multi-auction support, drag-and-drop photo organization, voice recording capabilities, and robust data export functionality. Authentication is handled via OTP-only Supabase integration with invite-only access.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 15 with App Router and TypeScript for type safety
- **PWA Implementation**: Progressive Web App with offline support using `@ducanh2912/next-pwa`
- **State Management**: Zustand for sync state management and React Context for authentication/toasts
- **Styling**: Tailwind CSS v4 with custom brand colors and mobile-first responsive design
- **Component Architecture**: Client-side components with dynamic imports for camera functionality

## Data Storage Strategy
- **Primary Storage**: Dexie (IndexedDB wrapper) for offline-first data persistence
- **Database Schema**: Four main tables (auctions, lots, media, blobs, meta) with auto-migration support
- **Binary Data**: Separate blob storage for media files with content-addressed keys
- **Metadata Management**: Key-value store for app configuration and lot numbering

## Authentication & Authorization
- **Provider**: Supabase with OTP-only authentication (no magic links or redirects)
- **Access Control**: Invite-only system with pre-registered emails and public signup disabled
- **Session Management**: Server-side session validation with middleware protection for API routes
- **Security**: Origin-based CSRF protection and secure context requirements for camera/microphone access

## Media Handling & Processing
- **Capture**: Multi-shot camera component with gesture controls and torch support
- **Audio Recording**: Voice notes with media recorder API and format detection
- **Image Processing**: Client-side downscaling and JPEG compression for optimal storage
- **Storage Pattern**: Content-addressed storage with SHA-256 hashing for deduplication

## Sync & Export Architecture
- **Sync Strategy**: Manual sync-only approach (disabled automatic syncing for better offline-first experience)
- **Queue Management**: Upload queue with retry logic and concurrent upload optimization
- **Export Options**: Local ZIP export with JSZip and cloud storage via R2/S3 presigned URLs
- **Data Format**: CSV export with media metadata and structured file organization

## Service Integration
- **Email Delivery**: Resend API for sending export notifications with rate limiting
- **Cloud Storage**: Cloudflare R2 (S3-compatible) for media and export file storage
- **Caching**: Service worker with network-first strategies and offline fallbacks

# External Dependencies

## Core Infrastructure
- **Database**: Supabase for authentication and optional cloud sync
- **Storage**: Cloudflare R2 for media files and export archives
- **Email**: Resend API for delivery notifications

## Key Libraries
- **PWA**: `@ducanh2912/next-pwa` for service worker and offline capabilities
- **Database**: `dexie` for IndexedDB operations with TypeScript support
- **Media**: `embla-carousel-react` for image galleries, `@zip.js/zip.js` for export bundling
- **UI**: `@dnd-kit` for drag-and-drop photo reordering, `lucide-react` for icons
- **Validation**: `zod` for runtime type checking and data validation

## Development Tools
- **TypeScript**: Strict mode enabled with path aliases
- **Linting**: ESLint with Next.js configuration
- **Styling**: Tailwind CSS with PostCSS processing and custom design tokens