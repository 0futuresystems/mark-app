import { supabase } from '../supabaseClient';
import { db } from '../../db';
import { Lot, MediaItem } from '../../types';

export interface SupabaseLot {
  id: string;
  auction_id: string;
  number: string;
  status: string;
  created_at: string;
  shared_at?: string;
  synced_at?: string;
}

export interface SupabaseMedia {
  id: string;
  lot_id: string;
  type: string;
  index_in_lot: number;
  object_key: string;
  etag: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  created_at: string;
}

export async function upsertLotToSupabase(lot: Lot): Promise<void> {
  const supabaseLot: SupabaseLot = {
    id: lot.id,
    auction_id: lot.auctionId,
    number: lot.number,
    status: lot.status,
    created_at: lot.createdAt.toISOString(),
    shared_at: lot.sharedAt,
    synced_at: lot.syncedAt
  };

  const { error } = await supabase
    .from('lots')
    .upsert(supabaseLot, {
      onConflict: 'id'
    });

  if (error) {
    throw new Error(`Failed to upsert lot ${lot.id}: ${error.message}`);
  }
}

export async function upsertMediaToSupabase(media: MediaItem): Promise<void> {
  if (!media.objectKey || !media.etag) {
    throw new Error(`Media ${media.id} missing objectKey or etag`);
  }

  const supabaseMedia: SupabaseMedia = {
    id: media.id,
    lot_id: media.lotId,
    type: media.type,
    index_in_lot: media.index,
    object_key: media.objectKey,
    etag: media.etag,
    bytes: media.bytesSize || 0,
    width: media.width,
    height: media.height,
    duration: media.duration,
    created_at: media.createdAt.toISOString()
  };

  const { error } = await supabase
    .from('media')
    .upsert(supabaseMedia, {
      onConflict: 'id'
    });

  if (error) {
    throw new Error(`Failed to upsert media ${media.id}: ${error.message}`);
  }
}

export async function syncLotAndMedia(lotId: string): Promise<void> {
  const lot = await db.lots.get(lotId);
  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const mediaItems = await db.media.where('lotId').equals(lotId).toArray();
  
  // Upsert lot first
  await upsertLotToSupabase(lot);
  
  // Upsert all media for this lot
  for (const media of mediaItems) {
    if (media.objectKey && media.etag) {
      await upsertMediaToSupabase(media);
    }
  }
}

export async function syncAuctionToSupabase(auctionId: string): Promise<void> {
  const [lots, allMedia] = await Promise.all([
    db.lots.where('auctionId').equals(auctionId).toArray(),
    db.media.toArray()
  ]);

  const lotIds = lots.map(lot => lot.id);
  const auctionMedia = allMedia.filter(m => lotIds.includes(m.lotId));

  // Upsert all lots
  for (const lot of lots) {
    await upsertLotToSupabase(lot);
  }

  // Upsert all media with objectKey and etag
  for (const media of auctionMedia) {
    if (media.objectKey && media.etag) {
      await upsertMediaToSupabase(media);
    }
  }
}

export async function markLotsAsSynced(lotIds: string[]): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Update local database
  await db.lots.where('id').anyOf(lotIds).modify({ syncedAt: timestamp });
  
  // Update Supabase
  const { error } = await supabase
    .from('lots')
    .update({ synced_at: timestamp })
    .in('id', lotIds);

  if (error) {
    throw new Error(`Failed to mark lots as synced: ${error.message}`);
  }
}
