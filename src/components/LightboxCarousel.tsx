'use client';
import { Dialog, DialogContent } from './Dialog';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { getMediaBlob } from '../lib/blobStore';
import { X, ChevronLeft, ChevronRight, Trash2, ZoomIn, ZoomOut, RotateCw, Info, Download } from 'lucide-react';
import { MediaItem } from '../types';

type ImageItem = { id: string; index?: number };

export default function LightboxCarousel({
  open,
  onOpenChange,
  items,
  startIndex = 0,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: ImageItem[];
  startIndex?: number;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ startIndex, loop: false });
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (embla) embla.reInit({ startIndex });
  }, [embla, startIndex]);

  useEffect(() => {
    if (!embla) return;
    const handler = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', handler);
    return () => {
      embla.off('select', handler);
    };
  }, [embla]);

  const current = items[index];

  const { url, loading, error } = useObjectUrl(
    async () => {
      if (!current) return null;
      try {
        console.log('[LightboxCarousel] Loading blob for:', current.id);
        const blob = await getMediaBlob(current.id);
        if (!blob) throw new Error('Blob not found');
        console.log('[LightboxCarousel] Got blob:', blob.size, 'bytes');
        return blob;
      } catch (err) {
        console.error('[LightboxCarousel] Failed to load blob:', current.id, err);
        throw err;
      }
    },
    [current?.id]
  );

  // Reset zoom and info when changing images
  useEffect(() => {
    setZoom(1);
    setShowInfo(false);
    setImageLoaded(false);
  }, [current?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          embla?.scrollPrev();
          break;
        case 'ArrowRight':
          embla?.scrollNext();
          break;
        case 'Escape':
          onOpenChange(false);
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(prev * 1.2, 3));
          break;
        case '-':
          setZoom(prev => Math.max(prev / 1.2, 0.5));
          break;
        case '0':
          setZoom(1);
          break;
        case 'i':
          setShowInfo(prev => !prev);
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, embla, onOpenChange]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));
  const handleZoomReset = () => setZoom(1);
  
  const handleDownload = useCallback(async () => {
    if (!url || !current) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `photo-${current.index || index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [url, current, index]);

  const doDelete = useCallback(async () => {
    if (!current || !onDelete) return;
    await onDelete(current.id);
    // after delete, stay at same index if possible
    const next = Math.min(index, Math.max(0, items.length - 2));
    setIndex(next);
    embla?.scrollTo(next);
  }, [current, index, onDelete, embla, items.length]);

  if (!open || items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] h-[98vh] p-0 bg-black/95 border-none overflow-hidden">
        {/* Top control bar */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-4">
          <div className="flex justify-between items-center">
            {/* Left controls */}
            <div className="flex items-center space-x-2">
              {items.length > 1 && (
                <div className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm font-medium">
                  {index + 1} / {items.length}
                </div>
              )}
              {current?.index && (
                <div className="px-3 py-1 bg-blue-500/20 backdrop-blur-sm text-white rounded-lg text-sm font-medium">
                  Photo #{current.index}
                </div>
              )}
            </div>
            
            {/* Right controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2 rounded-lg text-white transition-all duration-200 ${
                  showInfo ? 'bg-blue-500/60' : 'bg-white/20 hover:bg-white/30'
                } backdrop-blur-sm`}
                title="Toggle info (I)"
              >
                <Info className="w-4 h-4" />
              </button>
              
              <button
                onClick={handleDownload}
                className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white transition-all duration-200"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 bg-white/20 hover:bg-red-500/60 backdrop-blur-sm rounded-lg text-white transition-all duration-200"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        {items.length > 1 && (
          <>
            <button
              aria-label="Previous image"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-15 w-14 h-14 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => embla?.scrollPrev()}
              disabled={index === 0}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              aria-label="Next image"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-15 w-14 h-14 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => embla?.scrollNext()}
              disabled={index === items.length - 1}
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </>
        )}

        {/* Image container */}
        <div className="relative w-full h-full flex items-center justify-center pt-16 pb-16 overflow-hidden">
          {loading && (
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">Loading image...</p>
            </div>
          )}
          
          {error && (
            <div className="text-white text-center">
              <div className="text-red-400 text-6xl mb-4">⚠</div>
              <p className="text-lg">Failed to load image</p>
              <p className="text-sm text-gray-400 mt-2">Try refreshing or check your connection</p>
            </div>
          )}
          
          {url && !error && (
            <div 
              className="relative max-w-full max-h-full overflow-hidden"
              ref={emblaRef}
            >
              <div className="flex">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex-[0_0_100%] min-w-0">
                    {idx === index && (
                      <img 
                        src={url} 
                        alt={`Photo ${item.index || idx + 1}`}
                        className="max-w-full max-h-full object-contain transition-all duration-300 cursor-zoom-in"
                        style={{ 
                          transform: `scale(${zoom})`,
                          imageRendering: zoom > 1 ? 'crisp-edges' : 'auto'
                        }}
                        onLoad={() => setImageLoaded(true)}
                        onClick={() => {
                          if (zoom === 1) {
                            setZoom(2);
                          } else {
                            setZoom(1);
                          }
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom control bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/60 to-transparent p-4">
          <div className="flex justify-between items-center">
            {/* Left: Zoom controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm rounded-lg text-white transition-all duration-200"
                title="Zoom out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <div className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm font-medium min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </div>
              
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm rounded-lg text-white transition-all duration-200"
                title="Zoom in (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              
              <button
                onClick={handleZoomReset}
                className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white transition-all duration-200"
                title="Reset zoom (0)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
            
            {/* Right: Delete button */}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Delete this photo? This action cannot be undone.')) {
                    doDelete();
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white rounded-lg transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Info panel */}
        {showInfo && imageLoaded && (
          <div className="absolute top-20 right-4 z-25 w-80 bg-black/80 backdrop-blur-md text-white rounded-xl p-4 border border-white/20">
            <h3 className="font-semibold text-lg mb-3">Image Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Photo:</span>
                <span>#{current?.index || index + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Position:</span>
                <span>{index + 1} of {items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Zoom:</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <div className="pt-2 border-t border-white/20">
                <p className="text-gray-300 text-xs">
                  <strong>Keyboard shortcuts:</strong><br/>
                  ← → Navigate • + - Zoom • 0 Reset • I Info • Esc Close
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading overlay */}
        {!imageLoaded && url && !error && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm">Loading...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}