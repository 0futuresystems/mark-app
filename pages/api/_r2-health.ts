import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const keys = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET'] as const;
  const status = Object.fromEntries(keys.map(k => [k, !!process.env[k]]));
  res.status(200).json({
    ok: keys.every(k => !!process.env[k]),
    ...status,
    note: 'Pages Router endpoint.'
  });
}
