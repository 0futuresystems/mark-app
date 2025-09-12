import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';

// Interface for the data sent from client
interface ExportData {
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
    objectKey?: string;
  }>;
}

// Generate signed URL for R2 (stub implementation for now)
async function generateSignedUrl(r2Key: string): Promise<string> {
  // TODO: Implement actual R2 signed URL generation
  // For now, return a placeholder URL
  return `https://r2.example.com/${r2Key}?signed=true`;
}

// Convert data to CSV format
async function generateCSV(data: ExportData): Promise<string> {
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
  
  // Create a map of lots for quick lookup
  const lotMap = new Map(data.lots.map(lot => [lot.id, lot]));
  
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
        // Prefer objectKey over remotePath, fallback to empty string
        const r2Key = (media.objectKey || media.remotePath) || '';
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

export async function POST(request: NextRequest) {
  try {
    const data: ExportData = await request.json();
    
    // Validate the data structure
    if (!data.lots || !data.media || !Array.isArray(data.lots) || !Array.isArray(data.media)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected lots and media arrays.' },
        { status: 400 }
      );
    }

    // Generate CSV content
    const csvContent = await generateCSV(data);
    
    // Return CSV as response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="lots_export.csv"',
      },
    });

  } catch (error) {
    console.error('Error generating CSV export:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}
