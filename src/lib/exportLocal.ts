import JSZip from 'jszip';
import { db } from '../db';
import { Lot, MediaItem } from '../types';
import { getMediaBlob } from './media/getMediaBlob';
import { buildZipBundle } from './zip-bundle';

// Helper function to generate unique paths in ZIP
function uniquePath(basePath: string, used: Set<string>) {
  let p = basePath;
  let i = 1;
  const dot = basePath.lastIndexOf('.');
  while (used.has(p)) {
    p = dot > 0
      ? `${basePath.slice(0, dot)}-${i++}${basePath.slice(dot)}`
      : `${basePath}-${i++}`;
  }
  used.add(p);
  return p;
}

export interface ExportData {
  lots: Lot[];
  media: MediaItem[];
  auctionName: string;
}

export interface ExportProgress {
  current: number;
  total: number;
  label: string;
}

export async function getExportableData(auctionId: string): Promise<ExportData> {
  const [lots, allMedia] = await Promise.all([
    db.lots.where('auctionId').equals(auctionId).toArray(),
    db.media.toArray()
  ]);

  // Filter media to only include media from lots in the current auction
  const lotIds = lots.map(lot => lot.id);
  const auctionMedia = allMedia.filter(m => lotIds.includes(m.lotId));

  // Get auction name
  const auction = await db.auctions.get(auctionId);
  const auctionName = auction?.name || 'Unknown';

  return {
    lots,
    media: auctionMedia,
    auctionName
  };
}

export function generateCSVFromData(data: ExportData): string {
  const { lots, media, auctionName } = data;
  const csvRows: string[] = [];

  // CSV header
  csvRows.push('lotId,auctionId,auctionName,lotNumber,status,createdAt,mediaType,index,fileName,size,uploaded,remotePath');

  lots.forEach(lot => {
    const lotMedia = media.filter(m => m.lotId === lot.id);
    
    if (lotMedia.length === 0) {
      // Lot with no media
      csvRows.push([
        lot.id,
        lot.auctionId,
        auctionName,
        lot.number,
        lot.status,
        lot.createdAt.toISOString(),
        '',
        '0',
        '',
        '',
        '',
        ''
      ].join(','));
    } else {
      // Lot with media
      lotMedia.forEach(mediaItem => {
        const fileName = `${lot.number}_${mediaItem.type}_${mediaItem.index.toString().padStart(2, '0')}`;
        csvRows.push([
          lot.id,
          lot.auctionId,
          auctionName,
          lot.number,
          lot.status,
          lot.createdAt.toISOString(),
          mediaItem.type,
          mediaItem.index.toString(),
          fileName,
          mediaItem.bytesSize?.toString() || '',
          mediaItem.uploaded ? 'true' : 'false',
          mediaItem.remotePath || ''
        ].join(','));
      });
    }
  });

  return csvRows.join('\n');
}

export async function createExportZip(
  data: ExportData,
  onProgress?: (progress: ExportProgress) => void
): Promise<File> {
  const { lots, media, auctionName } = data;
  
  let currentStep = 0;
  const totalSteps = 2;

  // Step 1: Generate CSV
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Generating CSV data...'
  });

  const csvContent = generateCSVFromData(data);

  // Step 2: Prepare media entries for zip bundle
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Preparing media files...'
  });

  const entries = media.map(mediaItem => {
    // Determine file extension based on media type
    let extension = '';
    if (mediaItem.type === 'photo') {
      extension = '.jpg';
    } else if (mediaItem.type === 'mainVoice' || mediaItem.type === 'dimensionVoice' || mediaItem.type === 'keywordVoice') {
      extension = '.webm';
    }

    // Create predictable filename
    const lot = lots.find(l => l.id === mediaItem.lotId);
    const fileName = `${lot?.number || 'unknown'}_${mediaItem.type}_${mediaItem.index.toString().padStart(2, '0')}${extension}`;
    
    return {
      path: `media/${fileName}`,
      media: mediaItem // Pass the media item directly to getMediaBlob
    };
  });

  // Use the new zip bundle function
  const zipResult = await buildZipBundle(entries, csvContent, (progress) => {
    onProgress?.({
      current: currentStep,
      total: totalSteps,
      label: `Creating ZIP file... (${progress}%)`
    });
  });
  
  const today = new Date().toISOString().split('T')[0];
  const fileName = `mark-export_${auctionName.replace(/[^a-zA-Z0-9]/g, '_')}_${today}.zip`;
  
  // Log any errors for debugging
  if (zipResult.errors.length > 0) {
    console.warn(`Share Now: ${zipResult.errors.length} media files skipped:`, zipResult.errors);
  }
  
  return new File([zipResult.blob], fileName, { type: 'application/zip' });
}

export async function shareZipFile(file: File): Promise<boolean> {
  try {
    // Check if Web Share API supports files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Mark Export',
        text: 'Lot data export with photos and audio'
      });
      return true;
    }
  } catch (error) {
    console.warn('Web Share API failed:', error);
  }

  // Fallback to download
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return false;
}

export async function markLotsAsShared(lotIds: string[]): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.lots.where('id').anyOf(lotIds).modify({ sharedAt: timestamp });
}
