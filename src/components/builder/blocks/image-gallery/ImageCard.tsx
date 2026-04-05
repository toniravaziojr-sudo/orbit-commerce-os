// =============================================
// IMAGE GALLERY — ImageCard (Single Responsibility)
// Renders a single image with <picture>, hover effects, caption overlay
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { ZoomIn } from 'lucide-react';
import type { GalleryImage } from './types';

interface ImageCardProps {
  image: GalleryImage;
  index: number;
  aspectRatioClass: string;
  borderRadius?: number;
  enableLightbox: boolean;
  showCaptionOverlay?: boolean;
  onClick: () => void;
}

export function ImageCard({
  image,
  index,
  aspectRatioClass,
  borderRadius = 8,
  enableLightbox,
  showCaptionOverlay = true,
  onClick,
}: ImageCardProps) {
  const content = (
    <div
      className={cn(
        'relative overflow-hidden group',
        aspectRatioClass,
        enableLightbox && 'cursor-zoom-in'
      )}
      style={{ borderRadius }}
      onClick={enableLightbox ? onClick : undefined}
    >
      <picture>
        {image.srcMobile && (
          <source media="(max-width: 768px)" srcSet={image.srcMobile} />
        )}
        <img
          src={image.src}
          alt={image.alt || `Imagem ${index + 1}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </picture>

      {/* Lightbox zoom indicator */}
      {enableLightbox && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Caption overlay (grid mode) */}
      {showCaptionOverlay && image.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
          <p className="text-white text-sm">{image.caption}</p>
        </div>
      )}
    </div>
  );

  // Wrap in link if linkUrl is provided
  if (image.linkUrl) {
    return (
      <a href={image.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {content}
        {!showCaptionOverlay && image.caption && (
          <p className="text-sm text-muted-foreground mt-2 text-center">{image.caption}</p>
        )}
      </a>
    );
  }

  return (
    <div>
      {content}
      {!showCaptionOverlay && image.caption && (
        <p className="text-sm text-muted-foreground mt-2 text-center">{image.caption}</p>
      )}
    </div>
  );
}
