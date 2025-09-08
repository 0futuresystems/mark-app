import { db } from '../db';

export async function nextLotNumber(): Promise<string> {
  const meta = await db.meta.get('lotCounter');
  const currentCounter = meta?.value || 0;
  const nextCounter = currentCounter + 1;
  
  await db.meta.put({ key: 'lotCounter', value: nextCounter });
  
  return nextCounter.toString().padStart(4, '0');
}

