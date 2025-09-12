export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const keys = ['RESEND_API_KEY','SYNC_TO_EMAIL','EMAIL_FROM'] as const
  const status = Object.fromEntries(keys.map(k => [k, !!process.env[k]]))
  return new Response(JSON.stringify({
    ok: !!process.env.RESEND_API_KEY && !!process.env.SYNC_TO_EMAIL,
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev (default)',
    ...status
  }), { headers: { 'content-type': 'application/json' }})
}
