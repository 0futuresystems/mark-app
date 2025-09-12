import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { env } from '@/lib/env'
import { ensureAuthed } from '@/lib/ensureAuthed'
import { limit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const Body = z.object({
  subject: z.string().optional(),
  summary: z.string().optional(),
  userId: z.string().optional(),
  auctionId: z.string().optional(),
  csv: z.string().optional(),
  links: z.array(z.string()).optional(),
  to: z.string().email().optional(), // Allow client to specify recipient if in allowlist
})

export async function POST(req: Request) {
  try {
    const user = await ensureAuthed();
    if (!(await limit(`email:${user.id}`, 20))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    }

    const payload = Body.parse(await req.json());
    const { subject = 'Mark App Export', summary, userId, auctionId, csv, links, to } = payload;

    // Use EMAIL_FROM from env, fallback to default
    const FROM = env.server.EMAIL_FROM || 'Mark App <onboarding@resend.dev>';

    // Check if RESEND_API_KEY is configured
    if (!env.server.RESEND_API_KEY) {
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({ 
          error: 'Email not configured in development. Set RESEND_API_KEY to enable email sending.' 
        }, { status: 501 });
      }
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    // Determine recipient - use allowlist if provided
    let finalTo: string;
    if (to && env.server.EMAIL_ALLOWLIST) {
      const allowlist = env.server.EMAIL_ALLOWLIST.split(',').map(s => s.trim().toLowerCase());
      if (allowlist.includes(to.toLowerCase())) {
        finalTo = to;
      } else {
        return NextResponse.json({ error: 'Recipient not in allowlist' }, { status: 403 });
      }
    } else if (env.server.EMAIL_ALLOWLIST) {
      // Use first email in allowlist as default
      finalTo = env.server.EMAIL_ALLOWLIST.split(',')[0].trim();
    } else {
      return NextResponse.json({ error: 'No email recipients configured' }, { status: 500 });
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

    const resend = new Resend(env.server.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: FROM,
      to: finalTo,
      subject: `${subject}${auctionId ? ` [${auctionId}]` : ''}`,
      text: textBody,
      attachments
    });

    // Resend returns { data, error } instead of throwing
    if (result?.error) {
      console.error('📧 Resend error (full):', {
        name: result.error.name,
        message: result.error.message
      });
      return NextResponse.json(
        { error: `${result.error.name || 'Error'}: ${result.error.message}` },
        { status: 502 }
      );
    }

    const id = result?.data?.id ?? null;
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('📧 Email send failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    if ((error as any)?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }
}