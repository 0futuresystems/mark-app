import { db } from '../db';

export async function nextLotNumber(auctionId: string): Promise<string> {
  const metaKey = `lotCounter:${auctionId}`;
  const meta = await db.meta.get(metaKey);
  const currentCounter = (meta?.value as number) || 0;
  const nextCounter = currentCounter + 1;
  
  await db.meta.put({ key: metaKey, value: nextCounter });
  
  return nextCounter.toString().padStart(4, '0');
}

