import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod4';
import { ensureAuthed } from '@/lib/ensureAuthed';
import { limit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Interface for the data sent from client
interface ExportData {
  lots: Array<{
    id: string;
    number: string;
    auctionId: string;
    auctionName: string;
    status: string;
    createdAt: string;
    ownerId?: string; // Add ownerId for filtering
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

const Body = z.object({
  data: z.object({
    lots: z.array(z.object({
      id: z.string(),
      number: z.string(),
      auctionId: z.string(),
      auctionName: z.string(),
      status: z.string(),
      createdAt: z.string(),
      ownerId: z.string().optional(),
    })),
    media: z.array(z.object({
      id: z.string(),
      lotId: z.string(),
      type: z.string(),
      index: z.number(),
      uploaded: z.boolean(),
      remotePath: z.string().optional(),
      objectKey: z.string().optional(),
    })),
  }),
  auctionId: z.string().optional(),
  limit: z.number().max(5000).optional().default(5000), // Max 5k rows
});

// Convert data to CSV format
function generateCSV(data: ExportData, userId: string, auctionId?: string): string {
  const headers = [
    'auction_id',
    'auction_name', 
    'lot_number',
    'lot_status',
    'media_kind',
    'media_r2_key',
    'created_at'
  ];

  const rows: string[] = [];
  
  // Filter lots by ownerId and optional auctionId
  const filteredLots = data.lots.filter(lot => {
    if (lot.ownerId && lot.ownerId !== userId) return false;
    if (auctionId && lot.auctionId !== auctionId) return false;
    return true;
  });
  
  // Create a map of lots for quick lookup
  const lotMap = new Map(filteredLots.map(lot => [lot.id, lot]));
  
  // Group media by lot (only for filtered lots)
  const mediaByLot = new Map<string, typeof data.media>();
  data.media.forEach(media => {
    if (lotMap.has(media.lotId)) {
      if (!mediaByLot.has(media.lotId)) {
        mediaByLot.set(media.lotId, []);
      }
      mediaByLot.get(media.lotId)!.push(media);
    }
  });

  // Generate rows for each lot (with pagination limit)
  let rowCount = 0;
  for (const lot of filteredLots) {
    if (rowCount >= 5000) break; // Hard limit
    
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
        lot.createdAt
      ].map(field => `"${field}"`).join(','));
      rowCount++;
    } else {
      // Lot with media - create a row for each media item
      for (const media of lotMedia) {
        if (rowCount >= 5000) break; // Hard limit
        
        // Prefer objectKey over remotePath, fallback to empty string
        const r2Key = (media.objectKey || media.remotePath) || '';
        
        rows.push([
          lot.auctionId,
          lot.auctionName,
          lot.number,
          lot.status,
          media.type,
          r2Key,
          lot.createdAt
        ].map(field => `"${field}"`).join(','));
        rowCount++;
      }
    }
  }

  // Audit log
  console.log(`CSV Export: userId=${userId}, auctionId=${auctionId || 'all'}, rowCount=${rowCount}`);

  return [headers.join(','), ...rows].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const user = await ensureAuthed();
    if (!(await limit(`export:${user.id}`, 10))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    }

    const { data, auctionId, limit: maxRows } = Body.parse(await request.json());
    
    // Generate CSV content with user scoping
    const csvContent = generateCSV(data, user.id, auctionId);
    
    // Return CSV as response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="lots_export${auctionId ? `_${auctionId}` : ''}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error generating CSV export:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    if ((error as any)?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}
