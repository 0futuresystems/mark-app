import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';

export interface AuctionStats {
  total: number;
  draft: number;
  complete: number;
  sent: number;
}

export function useAuctionStats(currentAuctionId: string | null): AuctionStats {
  const [stats, setStats] = useState<AuctionStats>({
    total: 0,
    draft: 0,
    complete: 0,
    sent: 0
  });

  const loadStats = useCallback(async () => {
    try {
      if (currentAuctionId) {
        const lots = await db.lots.where('auctionId').equals(currentAuctionId).toArray();
        const total = lots.length;
        const draft = lots.filter(lot => lot.status === 'draft').length;
        const complete = lots.filter(lot => lot.status === 'complete').length;
        const sent = lots.filter(lot => lot.status === 'sent').length;
        
        setStats({ total, draft, complete, sent });
      } else {
        setStats({ total: 0, draft: 0, complete: 0, sent: 0 });
      }
    } catch (error) {
      console.error('Error loading auction stats:', error);
    }
  }, [currentAuctionId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return stats;
}
