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
  const FROM  = process.env.EMAIL_FROM || 'Mark App <onboarding@resend.dev>' // safe default

  if (!TO)  return NextResponse.json({ error: 'SYNC_TO_EMAIL not configured' }, { status: 500 })
  if (!KEY) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })

  let payload: Body
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { subject = 'Mark App Export', summary, userId, auctionId, csv, links } = payload

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
    const res = await resend.emails.send({
      from: FROM,         // MUST be a verified domain or onboarding@resend.dev
      to: TO,             // never accept client "to"
      subject: `${subject}${auctionId ? ` [${auctionId}]` : ''}`,
      text: textBody,
      attachments
    })
    return NextResponse.json({ ok: true, id: res?.data?.id ?? null })
  } catch (err: any) {
    console.error('📧 Email send failed:', {
      message: err?.message ?? String(err),
      stack: err?.stack,
    })
    return NextResponse.json({ error: err?.message || 'Email send failed' }, { status: 500 })
  }
}