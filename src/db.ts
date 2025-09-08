import Dexie, { Table } from 'dexie';
import { Lot, MediaItem, MediaBlob } from './types';

export class LotLoggerDB extends Dexie {
  lots!: Table<Lot>;
  media!: Table<MediaItem>;
  blobs!: Table<MediaBlob>;
  meta!: Table<{ key: string; value: any }>;

  constructor() {
    super('LotLoggerDB');
    this.version(1).stores({
      lots: 'id, number, status, createdAt',
      media: 'id, lotId, type, index, createdAt, uploaded, remotePath',
      blobs: 'id',
      meta: 'key'
    });
  }
}

export const db = new LotLoggerDB();

