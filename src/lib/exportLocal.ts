import JSZip from 'jszip';
import { db } from '../db';
import { Lot, MediaItem } from '../types';
import { getMediaBlob } from './blobStore';

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
          mediaItem.bytes?.toString() || '',
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
  const zip = new JSZip();
  
  let currentStep = 0;
  const totalSteps = 3;

  // Step 1: Generate CSV
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Generating CSV data...'
  });

  const csvContent = generateCSVFromData(data);
  zip.file('lots_data.csv', csvContent);

  // Step 2: Add media files
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Adding media files...'
  });

  const mediaFolder = zip.folder('media');
  let processedMedia = 0;
  const totalMedia = media.length;

  for (const mediaItem of media) {
    try {
      const blob = await getMediaBlob(mediaItem.id);
      if (blob) {
        // Determine file extension based on media type and blob type
        let extension = '';
        if (mediaItem.type === 'photo') {
          extension = blob.type.includes('jpeg') || blob.type.includes('jpg') ? '.jpg' : 
                     blob.type.includes('png') ? '.png' : '.jpg';
        } else if (mediaItem.type === 'mainVoice' || mediaItem.type === 'dimensionVoice' || mediaItem.type === 'keywordVoice') {
          extension = blob.type.includes('webm') ? '.webm' : 
                     blob.type.includes('mp3') ? '.mp3' : '.webm';
        }

        // Create predictable filename
        const lot = lots.find(l => l.id === mediaItem.lotId);
        const fileName = `${lot?.number || 'unknown'}_${mediaItem.type}_${mediaItem.index.toString().padStart(2, '0')}${extension}`;
        
        mediaFolder?.file(fileName, blob);
      } else {
        console.warn(`Missing media file for ${mediaItem.id}`);
      }
    } catch (error) {
      console.error(`Error processing media ${mediaItem.id}:`, error);
    }

    processedMedia++;
    onProgress?.({
      current: currentStep,
      total: totalSteps,
      label: `Adding media files... (${processedMedia}/${totalMedia})`
    });
  }

  // Step 3: Generate ZIP
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Creating ZIP file...'
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const today = new Date().toISOString().split('T')[0];
  const fileName = `mark-export_${auctionName.replace(/[^a-zA-Z0-9]/g, '_')}_${today}.zip`;
  
  return new File([zipBlob], fileName, { type: 'application/zip' });
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
