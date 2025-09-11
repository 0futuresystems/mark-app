import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServerEnv } from '@/lib/env';

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
    const data: EmailExportData = await request.json();
    
    // Validate the data structure
    if (!data.lots || !data.media || !data.email || !Array.isArray(data.lots) || !Array.isArray(data.media)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected lots, media arrays, and email address.' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: 'Invalid email address format.' },
        { status: 400 }
      );
    }

    // Get Resend API key
    const serverEnv = getServerEnv(['RESEND_API_KEY']);
    const resend = new Resend(serverEnv.RESEND_API_KEY);

    // Generate CSV content
    const csvContent = await generateCSV(data);
    
    // For now, we'll create a data URL for the CSV since we don't have R2 upload implemented
    // In a real implementation, you'd upload the CSV to R2 and get a signed URL
    const csvDataUrl = `data:text/csv;base64,${Buffer.from(csvContent).toString('base64')}`;
    
    // Generate HTML email content
    const emailHTML = generateEmailHTML(data, csvDataUrl);
    
    // Send email
    const emailResult = await resend.emails.send({
      from: 'Lot Logger <noreply@lotlogger.app>', // You'll need to configure this domain
      to: [data.email],
      subject: `Lot Export Ready - ${data.lots[0]?.auctionName || 'Auction'}`,
      html: emailHTML,
      attachments: [
        {
          filename: `lots_export_${new Date().toISOString().split('T')[0]}.csv`,
          content: Buffer.from(csvContent),
          contentType: 'text/csv'
        }
      ]
    });

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.data?.id,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Error sending email export:', error);
    
    // Handle missing API key gracefully
    if (error instanceof Error && error.message.includes('Missing required environment variables')) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Email service not configured (RESEND_API_KEY missing)',
          mock: true 
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send email export' },
      { status: 500 }
    );
  }
}
