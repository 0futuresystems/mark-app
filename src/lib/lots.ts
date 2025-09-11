import Dexie from 'dexie';
import { db } from '../db';

/**
 * Get the next lot number integer for a specific auction
 * @param auctionId The auction ID to get the next lot number for
 * @returns Promise<number> The next lot number integer
 */
export async function getNextLotNumberInt(auctionId: string): Promise<number> {
  try {
    // Query the maximum number_int for this auction
    const maxLot = await db.lots
      .where(['auctionId', 'number_int'])
      .between([auctionId, Dexie.minKey], [auctionId, Dexie.maxKey])
      .reverse()
      .first();
    
    // If no lots exist for this auction, start with 1
    if (!maxLot || !maxLot.number_int) {
      return 1;
    }
    
    // Return the next number
    return maxLot.number_int + 1;
  } catch (error) {
    console.error('Error getting next lot number:', error);
    // Fallback to 1 if there's an error
    return 1;
  }
}

/**
 * Format a lot number integer as a zero-padded string
 * @param n The lot number integer
 * @returns string The formatted lot number (e.g., "0001", "0002")
 */
export function formatLotNumber(n: number): string {
  return n.toString().padStart(4, '0');
}
