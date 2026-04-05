// =============================================
// IMAGE GALLERY — Orchestrator (Single Responsibility)
// Delegates to GridLayout or CarouselLayout based on layout prop
// =============================================

import React, { useState, useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { parseImages, getAspectRatioClass, getGapClass, toSafeNumber } from './helpers';
import { GridLayout } from './GridLayout';
import { CarouselLayout } from './CarouselLayout';
import { Lightbox } from './Lightbox';
import type { ImageGalleryBlockProps, GalleryImage } from './types';

export function ImageGalleryBlock({
  title,
  subtitle,
  images,
  imagesJson,
  layout = 'grid',
  columns = 3,
  borderRadius = 8,
  slidesPerView = 1,
  autoplay = false,
  autoplayInterval = 5,
  showArrows = true,
  showDots = true,
  gap = 'md',
  aspectRatio = 'square',
  enableLightbox = true,
  backgroundColor = 'transparent',
  context,
}: ImageGalleryBlockProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const isInBuilder = context?.viewport !== undefined;

  const parsedImages = useMemo(
    () => parseImages(images as GalleryImage[], imagesJson),
    [images, imagesJson]
  );

  const safeColumns = toSafeNumber(columns, 3);
  const safeSlidesPerView = toSafeNumber(slidesPerView, 1);
  const safeAutoplayInterval = toSafeNumber(autoplayInterval, 5);

  const aspectRatioClass = getAspectRatioClass(aspectRatio || 'square');
  const gapClass = getGapClass(gap || 'md');

  const handleImageClick = (index: number) => {
    if (isInBuilder) return;
    if (enableLightbox) setLightboxIndex(index);
  };

  const handleLightboxPrev = () =>
    setLightboxIndex(prev => prev !== null ? (prev === 0 ? parsedImages.length - 1 : prev - 1) : null);

  const handleLightboxNext = () =>
    setLightboxIndex(prev => prev !== null ? (prev === parsedImages.length - 1 ? 0 : prev + 1) : null);

  // Empty state
  if (parsedImages.length === 0) {
    if (isInBuilder) {
      return (
        <div className="p-8 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">Galeria de Imagens</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Adicione imagens nas propriedades</p>
        </div>
      );
    }
    return null;
  }

  return (
    <section className="py-10 md:py-14 px-4" style={{ backgroundColor }}>
      <div className="max-w-6xl mx-auto">
        {(title || subtitle) && (
          <div className="text-center mb-8 md:mb-10">
            {title && <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{title}</h2>}
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        )}

        {layout === 'carousel' ? (
          <CarouselLayout
            images={parsedImages}
            slidesPerView={safeSlidesPerView}
            gapClass={gapClass}
            aspectRatioClass={aspectRatioClass}
            borderRadius={borderRadius}
            enableLightbox={enableLightbox && !isInBuilder}
            autoplay={autoplay}
            autoplayInterval={safeAutoplayInterval}
            showArrows={showArrows}
            showDots={showDots}
            onImageClick={handleImageClick}
          />
        ) : (
          <GridLayout
            images={parsedImages}
            columns={safeColumns}
            gapClass={gapClass}
            aspectRatioClass={aspectRatioClass}
            borderRadius={borderRadius}
            enableLightbox={enableLightbox && !isInBuilder}
            onImageClick={handleImageClick}
          />
        )}

        {lightboxIndex !== null && parsedImages[lightboxIndex] && (
          <Lightbox
            images={parsedImages}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onPrev={handleLightboxPrev}
            onNext={handleLightboxNext}
          />
        )}
      </div>
    </section>
  );
}

export default ImageGalleryBlock;
