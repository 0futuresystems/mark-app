import Dexie, { Table } from 'dexie';
import { Auction, Lot, MediaItem, MediaBlob } from './types';

export class LotLoggerDB extends Dexie {
  auctions!: Table<Auction>;
  lots!: Table<Lot>;
  media!: Table<MediaItem>;
  blobs!: Table<MediaBlob>;
  meta!: Table<{ key: string; value: unknown }>;

  constructor() {
    super('LotLoggerDB');
    this.version(1).stores({
      lots: 'id, number, status, createdAt',
      media: 'id, lotId, type, index, createdAt, uploaded, remotePath',
      blobs: 'id',
      meta: 'key'
    });
    
    this.version(2).stores({
      auctions: 'id, name, createdAt',
      lots: 'id, number, auctionId, status, createdAt',
      media: 'id, lotId, type, index, createdAt, uploaded, remotePath',
      blobs: 'id',
      meta: 'key'
    }).upgrade(async (tx) => {
      // Migration: Add default auction and assign existing lots to it
      const defaultAuction: Auction = {
        id: 'default-auction',
        name: 'Default Auction',
        createdAt: Date.now()
      };
      
      await tx.table('auctions').add(defaultAuction);
      
      // Assign all existing lots to the default auction
      const existingLots = await tx.table('lots').toArray();
      for (const lot of existingLots) {
        await tx.table('lots').update(lot.id, { auctionId: 'default-auction' });
      }
    });
    
    this.version(3).stores({
      auctions: 'id, name, createdAt, archived',
      lots: 'id, number, auctionId, status, createdAt',
      media: 'id, lotId, type, index, createdAt, uploaded, remotePath',
      blobs: 'id',
      meta: 'key'
    }).upgrade(async (tx) => {
      // Migration: Add archived flag to existing auctions (default to false)
      const existingAuctions = await tx.table('auctions').toArray();
      for (const auction of existingAuctions) {
        await tx.table('auctions').update(auction.id, { archived: false });
      }
    });
    
    this.version(4).stores({
      auctions: 'id, name, createdAt, archived',
      lots: 'id, number, auctionId, status, createdAt',
      media: 'id, lotId, type, index, createdAt, uploaded, remotePath, needsSync, bytes, width, height, duration',
      blobs: 'id',
      meta: 'key'
    }).upgrade(async (tx) => {
      // Migration: Add new media fields (default to undefined/false)
      const existingMedia = await tx.table('media').toArray();
      for (const media of existingMedia) {
        await tx.table('media').update(media.id, { 
          needsSync: false,
          bytes: undefined,
          width: undefined,
          height: undefined,
          duration: undefined
        });
      }
    });
    
    this.version(5).stores({
      auctions: 'id, name, createdAt, archived',
      lots: 'id, number, auctionId, status, createdAt',
      media: 'id, lotId, type, index, createdAt, uploaded, remotePath, needsSync, mime, bytesSize, width, height, duration, objectKey, etag, uploadedAt',
      blobs: 'id',
      meta: 'key'
    }).upgrade(async (tx) => {
      // Migration: Add new media fields for offline-first approach
      const existingMedia = await tx.table('media').toArray();
      for (const media of existingMedia) {
        await tx.table('media').update(media.id, { 
          mime: media.mime || 'image/jpeg',
          bytesSize: media.bytesSize || 0,
          objectKey: undefined,
          etag: undefined,
          uploadedAt: undefined
        });
      }
    });
  }
}

export const db = new LotLoggerDB();

