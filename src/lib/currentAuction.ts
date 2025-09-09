import { db } from '../db';

const CURRENT_AUCTION_KEY = 'currentAuctionId';

export async function getCurrentAuctionId(): Promise<string | null> {
  try {
    const result = await db.meta.get(CURRENT_AUCTION_KEY);
    return result?.value as string | null || null;
  } catch (error) {
    console.error('Error getting current auction ID:', error);
    return null;
  }
}

export async function setCurrentAuctionId(auctionId: string | null): Promise<void> {
  try {
    if (auctionId === null) {
      await db.meta.delete(CURRENT_AUCTION_KEY);
    } else {
      await db.meta.put({ key: CURRENT_AUCTION_KEY, value: auctionId });
    }
  } catch (error) {
    console.error('Error setting current auction ID:', error);
  }
}

export async function getCurrentAuction() {
  try {
    const auctionId = await getCurrentAuctionId();
    if (!auctionId) return null;
    
    const auction = await db.auctions.get(auctionId);
    return auction || null;
  } catch (error) {
    console.error('Error getting current auction:', error);
    return null;
  }
}

