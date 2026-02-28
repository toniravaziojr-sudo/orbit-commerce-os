// =============================================
// HERO BANNER BLOCK - Main banner carousel with desktop/mobile images
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface BannerSlide {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  linkUrl?: string;
  altText?: string;
}

interface HeroBannerBlockProps {
  slides?: BannerSlide[];
  autoplaySeconds?: number;
  bannerWidth?: 'full' | 'contained';
  showArrows?: boolean;
  showDots?: boolean;
  context?: BlockRenderContext;
}

export function HeroBannerBlock({
  slides = [],
  autoplaySeconds = 5,
  bannerWidth = 'full',
  showArrows = true,
  showDots = true,
  context,
}: HeroBannerBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const realIsMobile = useIsMobile();
  
  // Defensive: ensure slides is always an array
  const safeSlides = Array.isArray(slides) ? slides : [];
  
  // Builder mode: use context.viewport state; Storefront: use real viewport
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = isBuilderMode 
    ? context.viewport === 'mobile' 
    : realIsMobile;

  // Autoplay
  useEffect(() => {
    if (safeSlides.length <= 1 || !autoplaySeconds) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
    }, autoplaySeconds * 1000);

    return () => clearInterval(interval);
  }, [safeSlides.length, autoplaySeconds]);

  // Reset index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= safeSlides.length && safeSlides.length > 0) {
      setCurrentIndex(0);
    }
  }, [safeSlides.length, currentIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + safeSlides.length) % safeSlides.length);
  }, [safeSlides.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
  }, [safeSlides.length]);

  // Empty state
  if (safeSlides.length === 0) {
    return (
      <div className={cn(
        'relative bg-muted/30 flex items-center justify-center',
        bannerWidth === 'full' ? 'w-full' : 'max-w-7xl mx-auto',
        'aspect-[21/9] md:aspect-[21/7]'
      )}>
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Adicione banners para exibir aqui</p>
        </div>
      </div>
    );
  }

  // Safe access to current slide
  const currentSlide = safeSlides[currentIndex] || safeSlides[0];
  const desktopImage = currentSlide?.imageDesktop;
  const mobileImage = currentSlide?.imageMobile || desktopImage;

  const content = (
    <div className={cn(
      'relative overflow-hidden',
      bannerWidth === 'full' ? 'w-full' : 'max-w-7xl mx-auto'
    )}>
      {/* Banner Image - Builder uses state-based selection; Storefront uses <picture> */}
      <div className="relative aspect-[21/9] md:aspect-[21/7]">
        {desktopImage ? (
          isBuilderMode ? (
            // Builder mode: select image based on viewport state
            <img
              src={isMobile && mobileImage ? mobileImage : desktopImage}
              alt={currentSlide?.altText || `Banner ${currentIndex + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            // Storefront mode: use <picture> for real responsive behavior
            <picture>
              {mobileImage && mobileImage !== desktopImage && (
                <source media="(max-width: 767px)" srcSet={mobileImage} />
              )}
              <img
                src={desktopImage}
                alt={currentSlide?.altText || `Banner ${currentIndex + 1}`}
                className="w-full h-full object-cover"
                fetchPriority="high"
                decoding="async"
                width={1920}
                height={686}
              />
            </picture>
          )
        ) : (
          <div className="w-full h-full bg-muted/30 flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Navigation Arrows */}
      {showArrows && safeSlides.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background shadow-lg transition-all"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background shadow-lg transition-all"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {showDots && safeSlides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {safeSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all',
                idx === currentIndex 
                  ? 'bg-primary w-6' 
                  : 'bg-background/60 hover:bg-background'
              )}
              aria-label={`Ir para banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  // Wrap in link if URL provided
  if (currentSlide?.linkUrl) {
    return (
      <a href={currentSlide.linkUrl} className="block">
        {content}
      </a>
    );
  }

  return content;
}
