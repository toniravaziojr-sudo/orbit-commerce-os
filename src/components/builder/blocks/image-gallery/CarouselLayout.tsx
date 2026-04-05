// =============================================
// IMAGE GALLERY — CarouselLayout (Single Responsibility)
// Renders images in an Embla carousel with multi-slide support
// =============================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageCard } from './ImageCard';
import { getSlideWidthClass } from './helpers';
import type { GalleryImage } from './types';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

interface CarouselLayoutProps {
  images: GalleryImage[];
  slidesPerView: number;
  gapClass: string;
  aspectRatioClass: string;
  borderRadius: number;
  enableLightbox: boolean;
  autoplay: boolean;
  autoplayInterval: number;
  showArrows: boolean;
  showDots: boolean;
  onImageClick: (index: number) => void;
}

export function CarouselLayout({
  images,
  slidesPerView,
  gapClass,
  aspectRatioClass,
  borderRadius,
  enableLightbox,
  autoplay,
  autoplayInterval,
  showArrows,
  showDots,
  onImageClick,
}: CarouselLayoutProps) {
  const autoplayPlugin = useMemo(
    () => autoplay ? Autoplay({ delay: autoplayInterval * 1000, stopOnInteraction: true }) : undefined,
    [autoplay, autoplayInterval]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: images.length > 1, slidesToScroll: 1, align: 'start' },
    autoplayPlugin ? [autoplayPlugin] : []
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const slideWidthClass = getSlideWidthClass(slidesPerView);

  return (
    <div className="sf-ig-carousel-container">
      <style>{`
        @media (max-width: 639px) {
          .sf-ig-carousel-container .sf-ig-slide { flex: 0 0 100% !important; }
          .sf-ig-carousel-container .sf-ig-gap { gap: 0 !important; }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .sf-ig-carousel-container .sf-ig-slide-multi { flex: 0 0 50% !important; }
        }
      `}</style>

      <div className="relative">
        <div className="overflow-hidden rounded-lg" ref={emblaRef}>
          <div className={cn('flex sf-ig-gap', gapClass)}>
            {images.map((image, index) => (
              <div
                key={image.id || index}
                className={cn(
                  'relative min-w-0 sf-ig-slide',
                  slidesPerView > 1 && 'sf-ig-slide-multi',
                  slideWidthClass
                )}
              >
                <ImageCard
                  image={image}
                  index={index}
                  aspectRatioClass={aspectRatioClass}
                  borderRadius={borderRadius}
                  enableLightbox={enableLightbox}
                  showCaptionOverlay={false}
                  onClick={() => onImageClick(index)}
                />
              </div>
            ))}
          </div>
        </div>

        {showArrows && images.length > slidesPerView && (
          <>
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-all z-10 sm:left-4",
                canScrollPrev ? "hover:bg-white cursor-pointer" : "opacity-50 cursor-not-allowed"
              )}
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="w-6 h-6" style={{ color: 'var(--theme-text-primary, #1a1a1a)' }} />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canScrollNext}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-all z-10 sm:right-4",
                canScrollNext ? "hover:bg-white cursor-pointer" : "opacity-50 cursor-not-allowed"
              )}
              aria-label="Próxima imagem"
            >
              <ChevronRight className="w-6 h-6" style={{ color: 'var(--theme-text-primary, #1a1a1a)' }} />
            </button>
          </>
        )}
      </div>

      {showDots && images.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all",
                index === selectedIndex
                  ? "w-6"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              style={index === selectedIndex ? { backgroundColor: 'var(--theme-accent-color, var(--theme-button-primary-bg, #1a1a1a))' } : undefined}
              aria-label={`Ir para imagem ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
