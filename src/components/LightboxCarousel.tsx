'use client';
import { Dialog, DialogContent } from './Dialog';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { getMediaBlob } from '../lib/blobStore';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

type ImageItem = { id: string };

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

  const { url } = useObjectUrl(
    () => current ? getMediaBlob(current.id) : Promise.resolve(null),
    [current?.id]
  );

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
      <DialogContent className="max-w-[95vw] h-[92vh] p-0 bg-black/95 border-none">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Navigation arrows */}
        {items.length > 1 && (
          <>
            <button
              aria-label="Previous"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              onClick={() => embla?.scrollPrev()}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              aria-label="Next"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              onClick={() => embla?.scrollNext()}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Image container */}
        <div className="relative w-full h-full flex items-center justify-center">
          {url ? (
            <img 
              src={url} 
              alt={`Photo ${index + 1}`} 
              className="max-w-full max-h-full object-contain" 
            />
          ) : (
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading image...</p>
            </div>
          )}
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={doDelete}
            className="absolute bottom-4 right-4 z-10 flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        )}

        {/* Image counter */}
        {items.length > 1 && (
          <div className="absolute bottom-4 left-4 z-10 px-3 py-1 bg-black/50 text-white rounded-lg text-sm">
            {index + 1} / {items.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
