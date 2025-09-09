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
}

export interface MediaItem {
  id: string;
  lotId: string;
  type: MediaType;
  index: number;
  createdAt: Date;
  uploaded: boolean;
  remotePath?: string;
}

export interface MediaBlob {
  id: string; // mediaId
  data: ArrayBuffer;
  mimeType: string;
  size: number;
}

