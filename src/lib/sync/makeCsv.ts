import { db } from '../../db';
import { Lot, MediaItem } from '../../types';
import { generatePresignedUrl } from './r2Client';

export interface CsvRow {
  lotId: string;
  auctionId: string;
  auctionName: string;
  lotNumber: string;
  status: string;
  createdAt: string;
  description: string;
  mediaType: string;
  index: number;
  fileName: string;
  size: string;
  uploaded: string;
  presignedUrl: string;
  expiresAt?: string;
}

export async function generateCloudCsv(
  auctionId: string,
  expiresIn: number = 14 * 24 * 60 * 60 // 14 days
): Promise<string> {
  const [auction, lots, allMedia] = await Promise.all([
    db.auctions.get(auctionId),
    db.lots.where('auctionId').equals(auctionId).toArray(),
    db.media.toArray()
  ]);

  const lotIds = lots.map(lot => lot.id);
  const auctionMedia = allMedia.filter(m => lotIds.includes(m.lotId));
  const auctionName = auction?.name || 'Unknown';

  const csvRows: CsvRow[] = [];

  for (const lot of lots) {
    const lotMedia = auctionMedia.filter(m => m.lotId === lot.id);
    
    if (lotMedia.length === 0) {
      // Lot with no media
      csvRows.push({
        lotId: lot.id,
        auctionId: lot.auctionId,
        auctionName,
        lotNumber: lot.number,
        status: lot.status,
        createdAt: lot.createdAt.toISOString(),
        description: lot.description ?? '',
        mediaType: '',
        index: 0,
        fileName: '',
        size: '',
        uploaded: 'false',
        presignedUrl: ''
      });
    } else {
      // Lot with media
      for (const mediaItem of lotMedia) {
        let presignedUrl = '';
        let expiresAt = '';
        
        if (mediaItem.objectKey) {
          try {
            const urlResult = await generatePresignedUrl(mediaItem.objectKey, expiresIn);
            if (urlResult) {
              presignedUrl = urlResult.url;
              expiresAt = urlResult.expiresAt.toISOString();
            }
          } catch (error) {
            console.warn(`Failed to generate presigned URL for ${mediaItem.objectKey}:`, error);
          }
        }

        const fileName = `${lot.number}_${mediaItem.type}_${mediaItem.index.toString().padStart(2, '0')}`;
        
        csvRows.push({
          lotId: lot.id,
          auctionId: lot.auctionId,
          auctionName,
          lotNumber: lot.number,
          status: lot.status,
          createdAt: lot.createdAt.toISOString(),
          description: lot.description ?? '',
          mediaType: mediaItem.type,
          index: mediaItem.index,
          fileName,
          size: mediaItem.bytesSize?.toString() || '',
          uploaded: mediaItem.objectKey ? 'true' : 'false',
          presignedUrl,
          expiresAt
        });
      }
    }
  }

  // Convert to CSV format
  const headers = [
    'lotId',
    'auctionId', 
    'auctionName',
    'lotNumber',
    'status',
    'createdAt',
    'description',
    'mediaType',
    'index',
    'fileName',
    'size',
    'uploaded',
    'presignedUrl',
    'expiresAt'
  ];

  const csvLines = [headers.join(',')];
  
  for (const row of csvRows) {
    const values = headers.map(header => {
      const value = row[header as keyof CsvRow];
      // Escape commas and quotes in CSV values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

export function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
