'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaItem } from '../types';
import LotThumbnail from './LotThumbnail';
import { Trash2, GripVertical, ChevronUp, ChevronDown, Eye } from 'lucide-react';

interface SortablePhotoItemProps {
  photo: MediaItem;
  index: number;
  onDelete: (mediaId: string) => void;
  onMove: (mediaId: string, direction: 'up' | 'down') => void;
  onOpenLightbox: (index: number) => void;
  totalPhotos: number;
}

function SortablePhotoItem({ 
  photo, 
  index, 
  onDelete, 
  onMove, 
  onOpenLightbox, 
  totalPhotos 
}: SortablePhotoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group flex justify-center items-center"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-20 w-6 h-6 bg-black/50 text-white rounded cursor-grab active:cursor-grabbing opacity-100 transition-opacity duration-200 flex items-center justify-center"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Photo thumbnail with click to view - fixed container */}
      <div 
        className="cursor-pointer transform transition-all duration-300 hover:scale-105 hover:z-10 relative"
        onClick={() => onOpenLightbox(index)}
        style={{ width: '128px', height: '128px' }}
      >
        <LotThumbnail 
          mediaItem={photo} 
          size="large" 
          className="shadow-lg hover:shadow-xl transition-shadow duration-300" 
          showOverlay={false}
        />
        
        {/* Enhanced overlay with controls - now properly sized */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent group-hover:from-black/70 group-hover:via-black/40 group-focus-within:from-black/70 group-focus-within:via-black/40 transition-all duration-300 rounded-xl flex flex-col justify-between p-2 pointer-events-none"
        >
        {/* Top controls - restore pointer events for buttons */}
        <div className="flex justify-end space-x-1 pointer-events-auto">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onMove(photo.id, 'up');
            }}
            disabled={totalPhotos <= 1}
            className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-110 active:scale-95"
            title={index === 0 ? 'Move to end' : 'Move up'}
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onMove(photo.id, 'down');
            }}
            disabled={totalPhotos <= 1}
            className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-110 active:scale-95"
            title={index === totalPhotos - 1 ? 'Move to beginning' : 'Move down'}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        
        {/* Center view indicator - clickable for lightbox */}
        <div className="flex-1 flex items-center justify-center pointer-events-auto">
          <div 
            className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white opacity-100 transition-opacity duration-300 cursor-pointer hover:bg-white/30"
            onClick={() => onOpenLightbox(index)}
            title="View full size"
          >
            <Eye className="w-4 h-4" />
          </div>
        </div>
        
        {/* Bottom controls - restore pointer events for buttons */}
        <div className="flex justify-between items-end pointer-events-auto">
          <div className="text-white text-xs font-semibold bg-black/40 px-2 py-1 rounded-lg backdrop-blur-sm">
            #{photo.index}
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this photo? This action cannot be undone.')) {
                onDelete(photo.id);
              }
            }}
            className="p-1.5 bg-red-500/80 backdrop-blur-sm rounded-lg text-white hover:bg-red-500 transform transition-all duration-200 hover:scale-110 active:scale-95"
            title="Delete photo"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        </div>
      </div>
      
    </div>
  );
}

interface PhotoGridProps {
  photos: MediaItem[];
  onReorder: (newOrder: MediaItem[]) => void;
  onDelete: (mediaId: string) => void;
  onMove: (mediaId: string, direction: 'up' | 'down') => void;
  onOpenLightbox: (index: number) => void;
}

export default function PhotoGrid({ 
  photos, 
  onReorder, 
  onDelete, 
  onMove, 
  onOpenLightbox 
}: PhotoGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement to activate drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms hold to activate drag on touch
        tolerance: 8, // 8px tolerance
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = photos.findIndex(photo => photo.id === active.id);
      const newIndex = photos.findIndex(photo => photo.id === over.id);
      
      const newOrder = arrayMove(photos, oldIndex, newIndex);
      
      // Update the index values to match the new order
      const updatedOrder = newOrder.map((photo, index) => ({
        ...photo,
        index: index + 1
      }));
      
      onReorder(updatedOrder);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {photos.map((photo, index) => (
            <SortablePhotoItem
              key={photo.id}
              photo={photo}
              index={index}
              onDelete={onDelete}
              onMove={onMove}
              onOpenLightbox={onOpenLightbox}
              totalPhotos={photos.length}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
