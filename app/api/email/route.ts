import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod4';

const emailSchema = z.object({
  subject: z.string().min(1),
  summary: z.string().optional(),
  userId: z.string().optional(),
  auctionId: z.string().optional(),
  csv: z.string().optional(),
  links: z.array(z.string()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.union([z.string(), z.instanceof(ArrayBuffer), z.any()])
  })).optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY!);

async function asBase64(c: any) {
  if (typeof c === 'string') return c.startsWith('data:') ? c.split(',')[1] : c; // if already base64
  if (c instanceof Blob) return Buffer.from(await c.arrayBuffer()).toString('base64');
  if (c instanceof ArrayBuffer) return Buffer.from(c).toString('base64');
  throw new Error('attachment content must be string/base64, Blob or ArrayBuffer');
}

export async function POST(request: NextRequest) {
  try {
    const missing = ['RESEND_API_KEY'].filter(k => !process.env[k]);
    if (missing.length) {
      return Response.json({ error: `Missing env: ${missing.join(', ')}` }, { status: 500 });
    }
    
    // Use verified Resend domain to avoid verification issues
    const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
    
    // Log the from address for debugging
    console.log('Email from address:', from);
    
    const body = await request.json();
    const { subject, summary, userId, auctionId, csv, links, attachments = [] } = emailSchema.parse(body);

    // Server-enforced recipient - always send to configured email
    const toEmail = process.env.SYNC_TO_EMAIL;
    if (!toEmail) {
      return NextResponse.json(
        { error: 'Sync email not configured' },
        { status: 500 }
      );
    }

    let emailContent = '';
    
    if (summary) {
      emailContent += `${summary}\n\n`;
    }

    if (userId) {
      emailContent += `User ID: ${userId}\n`;
    }

    if (auctionId) {
      emailContent += `Auction ID: ${auctionId}\n`;
    }

    if (links && links.length > 0) {
      emailContent += '\n📎 Download Links:\n';
      links.forEach((link, index) => {
        if (index === 0) {
          emailContent += `\n🔗 ZIP Download (CSV + Media): ${link}\n`;
          emailContent += `\nClick the link above to download your complete export package.\n`;
          emailContent += `The ZIP file contains:\n`;
          emailContent += `• export.csv - All lot data with media links\n`;
          emailContent += `• media/ folder - All captured photos and videos\n\n`;
        } else {
          emailContent += `${index + 1}. ${link}\n`;
        }
      });
    }

    if (!emailContent.trim()) {
      emailContent = 'Mark App Export - No additional details provided.';
    }

    // normalize attachments -> base64 and size-check
    const normalized = [];
    let totalBytes = 0;
    
    // Add CSV as attachment if provided
    if (csv) {
      totalBytes += Math.ceil((csv.length * 3) / 4); // approx raw size
      normalized.push({ filename: 'export.csv', content: csv });
    }
    
    // Add other attachments
    for (const a of attachments) {
      const b64 = await asBase64(a.content);
      totalBytes += Math.ceil((b64.length * 3) / 4); // approx raw size
      normalized.push({ filename: a.filename, content: b64 });
    }
    
    const estWithOverhead = Math.round(totalBytes * 1.33);
    if (estWithOverhead > 30 * 1024 * 1024) {
      return Response.json({ error: 'Attachments too large', code: 'ATTACHMENT_TOO_LARGE', maxMb: 30 }, { status: 413 });
    }

    const { data, error } = await resend.emails.send({
      from, 
      to: [toEmail], 
      subject, 
      text: emailContent,
      attachments: normalized.map(n => ({ filename: n.filename, content: n.content })),
    });
    
    if (error) throw error;
    return Response.json({ id: data?.id ?? null });
  } catch (e: any) {
    console.error('email send failed:', e);
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
