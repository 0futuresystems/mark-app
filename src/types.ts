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
  number_int?: number;
  auctionId: string;
  status: 'draft' | 'complete' | 'sent';
  createdAt: Date;
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
}

export interface MediaBlob {
  id: string; // mediaId
  data: ArrayBuffer;
  mimeType: string;
  size: number;
}

