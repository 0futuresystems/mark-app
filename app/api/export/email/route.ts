import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
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

export const runtime = 'nodejs';

// Interface for the data sent from client
interface EmailExportData {
  lots: Array<{
    id: string;
    number: string;
    auctionId: string;
    auctionName: string;
    status: string;
    createdAt: string;
  }>;
  media: Array<{
    id: string;
    lotId: string;
    type: string;
    index: number;
    uploaded: boolean;
    remotePath?: string;
  }>;
  email: string;
}

// Generate signed URL for R2 (stub implementation for now)
async function generateSignedUrl(r2Key: string): Promise<string> {
  // TODO: Implement actual R2 signed URL generation
  // For now, return a placeholder URL
  return `https://r2.example.com/${r2Key}?signed=true`;
}

// Convert data to CSV format
async function generateCSV(data: EmailExportData): Promise<string> {
  const headers = [
    'auction_id',
    'auction_name', 
    'lot_number',
    'lot_status',
    'media_kind',
    'media_r2_key',
    'media_url_signed'
  ];

  const rows: string[] = [];
  
  // Group media by lot
  const mediaByLot = new Map<string, typeof data.media>();
  data.media.forEach(media => {
    if (!mediaByLot.has(media.lotId)) {
      mediaByLot.set(media.lotId, []);
    }
    mediaByLot.get(media.lotId)!.push(media);
  });

  // Generate rows for each lot
  for (const lot of data.lots) {
    const lotMedia = mediaByLot.get(lot.id) || [];
    
    if (lotMedia.length === 0) {
      // Lot with no media - create a single row
      rows.push([
        lot.auctionId,
        lot.auctionName,
        lot.number,
        lot.status,
        '', // no media kind
        '', // no R2 key
        ''  // no signed URL
      ].map(field => `"${field}"`).join(','));
    } else {
      // Lot with media - create a row for each media item
      for (const media of lotMedia) {
        const r2Key = media.uploaded && media.remotePath ? media.remotePath : '';
        const signedUrl = r2Key ? await generateSignedUrl(r2Key) : '';
        
        rows.push([
          lot.auctionId,
          lot.auctionName,
          lot.number,
          lot.status,
          media.type,
          r2Key,
          signedUrl
        ].map(field => `"${field}"`).join(','));
      }
    }
  }

  return [headers.join(','), ...rows].join('\n');
}

// Generate HTML email content
function generateEmailHTML(data: EmailExportData, csvUrl: string): string {
  const auctionName = data.lots[0]?.auctionName || 'Unknown Auction';
  const totalLots = data.lots.length;
  const totalMedia = data.media.length;
  const uploadedMedia = data.media.filter(m => m.uploaded).length;
  
  // Get top 5 lots for preview
  const topLots = data.lots.slice(0, 5);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Lot Export - ${auctionName}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats { display: flex; justify-content: space-between; margin: 20px 0; }
        .stat { text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
        .stat-label { font-size: 14px; color: #666; }
        .lot-list { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .lot-item { padding: 8px 0; border-bottom: 1px solid #dee2e6; }
        .lot-item:last-child { border-bottom: none; }
        .download-btn { 
          display: inline-block; 
          background: #007bff; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          font-weight: bold;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📦 Lot Export Ready</h1>
          <p>Your lot data export for <strong>${auctionName}</strong> is ready for download.</p>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-number">${totalLots}</div>
            <div class="stat-label">Total Lots</div>
          </div>
          <div class="stat">
            <div class="stat-number">${totalMedia}</div>
            <div class="stat-label">Media Items</div>
          </div>
          <div class="stat">
            <div class="stat-number">${uploadedMedia}</div>
            <div class="stat-label">Uploaded</div>
          </div>
        </div>
        
        ${topLots.length > 0 ? `
        <div class="lot-list">
          <h3>📋 Sample Lots (${topLots.length} of ${totalLots})</h3>
          ${topLots.map(lot => `
            <div class="lot-item">
              <strong>Lot #${lot.number}</strong> - ${lot.status}
              <span style="float: right; color: #666;">${new Date(lot.createdAt).toLocaleDateString()}</span>
            </div>
          `).join('')}
          ${totalLots > 5 ? `<p style="margin-top: 10px; color: #666; font-style: italic;">... and ${totalLots - 5} more lots</p>` : ''}
        </div>
        ` : ''}
        
        <div style="text-align: center;">
          <a href="${csvUrl}" class="download-btn">📥 Download CSV with Media Links</a>
        </div>
        
        <div class="footer">
          <p>This CSV contains all lot data with R2 media keys and signed URLs for direct access to your media files.</p>
          <p><strong>Note:</strong> Signed URLs expire after 1 hour for security.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const missing = ['RESEND_API_KEY'].filter(k => !process.env[k]);
    if (missing.length) {
      return Response.json({ error: `Missing env: ${missing.join(', ')}` }, { status: 500 });
    }
    const from = process.env.RESEND_FROM || 'Mark App <onboarding@resend.dev>';
    
    const body = await request.json();
    const { to, subject, html, text, attachments = [] } = emailSchema.parse(body);

    // normalize attachments -> base64 and size-check
    const normalized = [];
    let totalBytes = 0;
    
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
      to, 
      subject, 
      html: html || undefined, 
      text: text || 'No content',
      attachments: normalized.map(n => ({ filename: n.filename, content: n.content })),
    });
    
    if (error) throw error;
    return Response.json({ id: data?.id ?? null });
  } catch (e: any) {
    console.error('email send failed:', e);
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
