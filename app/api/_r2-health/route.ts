import { NextRequest } from 'next/server';
import { ensureAuthed } from '@/src/lib/ensureAuthed';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // In production, return 404
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  try {
    // Require authentication
    await ensureAuthed();
    
    // Check admin key
    const url = new URL(req.url);
    const adminKey = url.searchParams.get('adminKey');
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return new Response('Forbidden', { status: 403 });
    }

    const keys = ['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET'];
    const status = Object.fromEntries(keys.map(k => [k, !!process.env[k]]));
    return new Response(JSON.stringify({
      ok: keys.every(k => !!process.env[k]),
      ...status,
      note: 'Node runtime. If ok=false, set env vars + restart.'
    }), { headers: { 'content-type': 'application/json' }});
  } catch (error) {
    return new Response('Unauthorized', { status: 401 });
  }
}