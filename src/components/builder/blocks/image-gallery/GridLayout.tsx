// =============================================
// IMAGE GALLERY — GridLayout (Single Responsibility)
// Renders images in a responsive CSS grid
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { ImageCard } from './ImageCard';
import type { GalleryImage } from './types';

interface GridLayoutProps {
  images: GalleryImage[];
  columns: number;
  gapClass: string;
  aspectRatioClass: string;
  borderRadius: number;
  enableLightbox: boolean;
  onImageClick: (index: number) => void;
}

export function GridLayout({
  images,
  columns,
  gapClass,
  aspectRatioClass,
  borderRadius,
  enableLightbox,
  onImageClick,
}: GridLayoutProps) {
  const colClasses: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={cn('grid', colClasses[columns] || colClasses[3], gapClass)}>
      {images.map((image, index) => (
        <ImageCard
          key={image.id || index}
          image={image}
          index={index}
          aspectRatioClass={aspectRatioClass}
          borderRadius={borderRadius}
          enableLightbox={enableLightbox}
          showCaptionOverlay={true}
          onClick={() => onImageClick(index)}
        />
      ))}
    </div>
  );
}
