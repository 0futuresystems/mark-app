import { NextRequest } from 'next/server';
import { ensureAuthed } from '@/src/lib/ensureAuthed';

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const keys = ['RESEND_API_KEY','EMAIL_FROM','EMAIL_ALLOWLIST'] as const
    const status = Object.fromEntries(keys.map(k => [k, !!process.env[k]]))
    return new Response(JSON.stringify({
      ok: !!process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev (default)',
      ...status
    }), { headers: { 'content-type': 'application/json' }})
  } catch (error) {
    return new Response('Unauthorized', { status: 401 });
  }
}
