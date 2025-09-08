export type MediaType = 'photo' | 'mainVoice' | 'dimensionVoice' | 'keywordVoice';

export interface Lot {
  id: string;
  number: string;
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

