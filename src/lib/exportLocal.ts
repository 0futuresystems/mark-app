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

// Helper function to collect entries for a single lot
function collectLotEntries(lot: Lot, lotMedia: MediaItem[]): Array<{ path: string; media?: MediaItem; text?: string }> {
  const entries: Array<{ path: string; media?: MediaItem; text?: string }> = [];
  
  // Add description.txt for the lot
  const description = lot.description?.trim() || "No description provided.";
  entries.push({
    path: `${lot.number}/description.txt`,
    text: description
  });
  
  // Add media files for the lot
  lotMedia.forEach(mediaItem => {
    // Determine file extension based on media type
    let extension = '';
    if (mediaItem.type === 'photo') {
      extension = '.jpg';
    } else if (mediaItem.type === 'mainVoice' || mediaItem.type === 'dimensionVoice' || mediaItem.type === 'keywordVoice') {
      extension = '.webm';
    }

    // Create predictable filename (same as before, just moved to lot folder)
    const fileName = `${lot.number}_${mediaItem.type}_${mediaItem.index.toString().padStart(2, '0')}${extension}`;
    
    entries.push({
      path: `${lot.number}/${fileName}`,
      media: mediaItem
    });
  });
  
  return entries;
}

export async function createExportZip(
  data: ExportData,
  onProgress?: (progress: ExportProgress) => void
): Promise<File> {
  const { lots, media, auctionName } = data;
  
  let currentStep = 0;
  const totalSteps = 2;

  // Step 1: Prepare entries for zip bundle
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Organizing files by lot...'
  });

  const allEntries: Array<{ path: string; media?: MediaItem; text?: string }> = [];

  // Process each lot and collect its entries
  lots.forEach(lot => {
    const lotMedia = media.filter(m => m.lotId === lot.id);
    const lotEntries = collectLotEntries(lot, lotMedia);
    allEntries.push(...lotEntries);
  });

  // Step 2: Create ZIP file
  onProgress?.({
    current: ++currentStep,
    total: totalSteps,
    label: 'Creating ZIP file...'
  });

  // Use the updated zip bundle function (no CSV needed)
  const zipResult = await buildZipBundle(allEntries, (progress) => {
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
    console.warn(`Share Now: ${zipResult.errors.length} files skipped:`, zipResult.errors);
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
