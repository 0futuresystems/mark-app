import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Body = {
  subject?: string
  summary?: string
  userId?: string
  auctionId?: string
  csv?: string            // optional attachment content
  links?: string[]        // optional links in body
}

export async function POST(req: Request) {
  const TO    = process.env.SYNC_TO_EMAIL       // hard-locked recipient
  const KEY   = process.env.RESEND_API_KEY
// Hard-lock a known-good sender for testing/delivery
const FROM = 'Mark App <onboarding@resend.dev>' // ignore EMAIL_FROM for now

  if (!TO)  return NextResponse.json({ error: 'SYNC_TO_EMAIL not configured' }, { status: 500 })
  if (!KEY) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })

  let payload: Body
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { subject = 'Mark App Export', summary, userId, auctionId, csv, links } = payload

  // Optional allowlist to test another recipient
  const allow = (process.env.EMAIL_TEST_ALLOW || '').split(',').map(s => s.trim()).filter(Boolean)
  let finalTo = process.env.SYNC_TO_EMAIL!
  if (payload && typeof (payload as any).to === 'string') {
    const candidate = (payload as any).to.trim().toLowerCase()
    if (allow.includes(candidate)) finalTo = candidate
  }

  const textBody = [
    summary ? `Summary: ${summary}` : '',
    userId ? `User: ${userId}` : '',
    auctionId ? `Auction: ${auctionId}` : '',
    Array.isArray(links) && links.length ? `Links:\n${links.join('\n')}` : ''
  ].filter(Boolean).join('\n\n') || 'See attached CSV or links.'

  const attachments = (typeof csv === 'string' && csv.length > 0)
    ? [{ filename: `export_${auctionId || 'lots'}.csv`, content: Buffer.from(csv), contentType: 'text/csv' }]
    : undefined

  try {
    const resend = new Resend(KEY)
    const result = await resend.emails.send({
      from: FROM,                      // server-enforced sender
      to: finalTo,                     // server-enforced recipient (or allowlisted test)
      subject: `${subject}${auctionId ? ` [${auctionId}]` : ''}`,
      text: textBody,
      attachments                      // may be undefined
    })

    // Resend returns { data, error } instead of throwing
    if (result?.error) {
      console.error('📧 Resend error (full):', {
        name: result.error.name,
        message: result.error.message
      })
      return NextResponse.json(
        { error: `${result.error.name || 'Error'}: ${result.error.message}` },
        { status: 502 }
      )
    }

    const id = result?.data?.id ?? null
    return NextResponse.json({ ok: true, id })
  } catch (err: any) {
    console.error('📧 Email send failed:', {
      message: err?.message ?? String(err),
      stack: err?.stack,
    })
    return NextResponse.json({ error: err?.message || 'Email send failed' }, { status: 500 })
  }
}