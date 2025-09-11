export type MediaType = 'photo' | 'mainVoice' | 'dimensionVoice' | 'keywordVoice';

export interface Auction {
  id: string;
  name: string;
  createdAt: number;
  archived?: boolean;
}

export interface Lot {
  id: string;
  number: string;
  auctionId: string;
  status: 'draft' | 'complete' | 'sent';
  createdAt: Date;
  sharedAt?: string; // ISO timestamp when locally shared (ZIP)
  syncedAt?: string; // ISO timestamp when synced to cloud
}

export interface MediaItem {
  id: string;
  lotId: string;
  type: MediaType;
  index: number;
  createdAt: Date;
  uploaded: boolean;
  remotePath?: string;
  needsSync?: boolean; // Flag for pending Supabase sync
  // Media metadata for Supabase
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number; // For audio files
  // Cloud storage metadata
  objectKey?: string; // R2/S3 object key for content-addressed storage
  etag?: string; // ETag from cloud storage for deduplication
}

export interface MediaBlob {
  id: string; // mediaId
  data: ArrayBuffer;
  mimeType: string;
  size: number;
}

