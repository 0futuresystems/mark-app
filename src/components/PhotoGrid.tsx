'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaItem } from '../types';
import LotThumbnail from './LotThumbnail';
import { Trash2, GripVertical } from 'lucide-react';

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
      className="relative group"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-20 w-6 h-6 bg-black/50 text-white rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Photo thumbnail with click to view */}
      <div 
        className="cursor-pointer transform transition-all duration-150 hover:scale-105"
        onClick={() => onOpenLightbox(index)}
      >
        <LotThumbnail mediaItem={photo} size="medium" className="w-full" />
      </div>
      
      {/* Overlay with controls - More prominent styling */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 rounded-lg flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col space-y-1">
          <div className="flex space-x-1 justify-center">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onMove(photo.id, 'up');
              }}
              disabled={index === 0}
              className="p-2 bg-brand-accent rounded-lg text-white hover:bg-brand-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-150 hover:scale-110 active:scale-95"
              title="Move up"
            >
              ↑
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onMove(photo.id, 'down');
              }}
              disabled={index === totalPhotos - 1}
              className="p-2 bg-brand-accent rounded-lg text-white hover:bg-brand-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-150 hover:scale-110 active:scale-95"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this photo? This action cannot be undone.')) {
                onDelete(photo.id);
              }
            }}
            className="px-3 py-2 bg-red-500 rounded-lg text-white hover:bg-red-600 font-medium text-sm transform transition-all duration-150 hover:scale-110 active:scale-95 shadow-soft"
            title="Delete photo"
          >
            <Trash2 className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </div>
      
      {/* Photo index indicator */}
      <div className="absolute top-2 left-2 bg-brand-accent text-white text-sm px-2 py-1 rounded-lg font-medium shadow-soft">
        #{photo.index}
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
    useSensor(PointerSensor),
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
      <SortableContext items={photos.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
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
