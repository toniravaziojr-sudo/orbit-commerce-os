// =============================================
// IMAGE CAROUSEL BLOCK - Display multiple images in a slider
// =============================================
// Supports multiple image uploads with Desktop/Mobile variants
// Features: Navigation, Autoplay, Lightbox, Multiple aspect ratios
// =============================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

interface ImageItem {
  id: string;
  srcDesktop: string;
  srcMobile?: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
}

interface ImageCarouselBlockProps {
  title?: string;
  images?: ImageItem[];
  imagesJson?: string; // Alternative: JSON string of images
  autoplay?: boolean;
  autoplayInterval?: number; // in seconds
  showArrows?: boolean;
  showDots?: boolean;
  enableLightbox?: boolean;
  aspectRatio?: '16:9' | '4:3' | '1:1' | '21:9' | 'auto';
  slidesPerView?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  context?: BlockRenderContext;
}

// Parse images from various input formats
function parseImages(images?: ImageItem[], imagesJson?: string): ImageItem[] {
  // Try from array prop first
  if (images && Array.isArray(images) && images.length > 0) {
    return images.filter(img => img.srcDesktop);
  }
  
  // Try from JSON string
  if (imagesJson) {
    try {
      const parsed = JSON.parse(imagesJson);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => {
          if (typeof item === 'string') {
            return { id: `img-${index}`, srcDesktop: item };
          }
          return {
            id: item.id || `img-${index}`,
            srcDesktop: item.srcDesktop || item.src || item.url || '',
            srcMobile: item.srcMobile,
            alt: item.alt,
            caption: item.caption,
            linkUrl: item.linkUrl,
          };
        }).filter(img => img.srcDesktop);
      }
    } catch {
      // Try as comma-separated URLs
      const urls = imagesJson.split(',').map(s => s.trim()).filter(Boolean);
      return urls.map((url, index) => ({
        id: `img-${index}`,
        srcDesktop: url,
      }));
    }
  }
  
  return [];
}

export function ImageCarouselBlock({
  title,
  images,
  imagesJson,
  autoplay = false,
  autoplayInterval = 5,
  showArrows = true,
  showDots = true,
  enableLightbox = false,
  aspectRatio = '16:9',
  slidesPerView = 1,
  gap = 'md',
  context,
}: ImageCarouselBlockProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Detect if we're in the Builder editor (viewport is defined only in builder)
  const isInBuilder = context?.viewport !== undefined;
  
  // Parse images from props
  const parsedImages = useMemo(() => parseImages(images, imagesJson), [images, imagesJson]);
  
  // Setup Embla Carousel
  const autoplayPlugin = useMemo(
    () => autoplay ? Autoplay({ delay: autoplayInterval * 1000, stopOnInteraction: true }) : undefined,
    [autoplay, autoplayInterval]
  );
  
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { 
      loop: parsedImages.length > 1,
      slidesToScroll: 1,
      align: 'start',
    },
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
  
  // Aspect ratio classes
  const aspectRatioClass = useMemo(() => {
    switch (aspectRatio) {
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      case '21:9': return 'aspect-[21/9]';
      case 'auto': return '';
      default: return 'aspect-video';
    }
  }, [aspectRatio]);
  
  // Gap classes
  const gapClass = useMemo(() => {
    switch (gap) {
      case 'sm': return 'gap-2';
      case 'lg': return 'gap-6';
      default: return 'gap-4';
    }
  }, [gap]);
  
  // Slides per view class - adjusts for mobile
  // On mobile (when container is < 640px), show max 2 slides regardless of setting
  const slideWidthClass = useMemo(() => {
    switch (slidesPerView) {
      case 2: return 'flex-[0_0_50%] sf-carousel-slide-mobile';
      case 3: return 'flex-[0_0_33.333%] sf-carousel-slide-mobile';
      case 4: return 'flex-[0_0_25%] sf-carousel-slide-mobile';
      default: return 'flex-[0_0_100%]';
    }
  }, [slidesPerView]);
  
  // Empty state
  if (parsedImages.length === 0) {
    if (isInBuilder) {
      return (
        <div className="p-8 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">Carrossel de Imagens</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Adicione imagens nas propriedades
          </p>
        </div>
      );
    }
    return null;
  }
  
  const handleImageClick = (index: number) => {
    if (isInBuilder) return;
    if (enableLightbox) {
      setLightboxIndex(index);
    }
  };
  
  return (
    <div className="image-carousel w-full sf-carousel-container">
      {/* Mobile-responsive styles - CRITICAL: Force single slide on mobile */}
      <style>{`
        /* Mobile: Always show 1 slide, regardless of slidesPerView setting */
        @media (max-width: 639px) {
          .sf-carousel-container .sf-carousel-slide-responsive {
            flex: 0 0 100% !important;
            min-width: 100% !important;
          }
          .sf-carousel-container .sf-carousel-gap-responsive {
            gap: 0 !important;
          }
        }
        /* Tablet: Show max 2 slides */
        @media (min-width: 640px) and (max-width: 1023px) {
          .sf-carousel-container .sf-carousel-slide-2,
          .sf-carousel-container .sf-carousel-slide-3,
          .sf-carousel-container .sf-carousel-slide-4 {
            flex: 0 0 50% !important;
          }
        }
      `}</style>
      
      {/* Title */}
      {title && (
        <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      )}
      
      {/* Carousel */}
      <div className="relative">
        <div className="overflow-hidden rounded-lg" ref={emblaRef}>
          <div className={cn('flex sf-carousel-gap-responsive', gapClass)}>
            {parsedImages.map((image, index) => (
              <div 
                key={image.id}
                className={cn(
                  'relative min-w-0 sf-carousel-slide-responsive',
                  `sf-carousel-slide-${slidesPerView}`,
                  slideWidthClass
                )}
              >
                {image.linkUrl && !isInBuilder ? (
                  <a 
                    href={image.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <ImageSlide 
                      image={image} 
                      aspectRatioClass={aspectRatioClass}
                      enableLightbox={enableLightbox}
                      onClick={() => handleImageClick(index)}
                    />
                  </a>
                ) : (
                  <ImageSlide 
                    image={image} 
                    aspectRatioClass={aspectRatioClass}
                    enableLightbox={enableLightbox && !isInBuilder}
                    onClick={() => handleImageClick(index)}
                  />
                )}
                {image.caption && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">{image.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation arrows - Theme-aware */}
        {showArrows && parsedImages.length > slidesPerView && (
          <>
            <button
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-all z-10",
                "sm:left-4",
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
                "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-all z-10",
                "sm:right-4",
                canScrollNext ? "hover:bg-white cursor-pointer" : "opacity-50 cursor-not-allowed"
              )}
              aria-label="Próxima imagem"
            >
              <ChevronRight className="w-6 h-6" style={{ color: 'var(--theme-text-primary, #1a1a1a)' }} />
            </button>
          </>
        )}
      </div>
      
      {/* Dots indicators - Theme-aware accent color */}
      {showDots && parsedImages.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {parsedImages.map((_, index) => (
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
      
      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={parsedImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(prev => prev !== null ? (prev === 0 ? parsedImages.length - 1 : prev - 1) : null)}
          onNext={() => setLightboxIndex(prev => prev !== null ? (prev === parsedImages.length - 1 ? 0 : prev + 1) : null)}
        />
      )}
    </div>
  );
}

// Image slide component
function ImageSlide({ 
  image, 
  aspectRatioClass,
  enableLightbox,
  onClick,
}: { 
  image: ImageItem; 
  aspectRatioClass: string;
  enableLightbox: boolean;
  onClick: () => void;
}) {
  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-lg bg-muted group',
        aspectRatioClass,
        enableLightbox && 'cursor-zoom-in'
      )}
      onClick={onClick}
    >
      <picture>
        {image.srcMobile && (
          <source media="(max-width: 768px)" srcSet={image.srcMobile} />
        )}
        <img
          src={image.srcDesktop}
          alt={image.alt || 'Imagem do carrossel'}
          className="w-full h-full object-cover"
        />
      </picture>
      {enableLightbox && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// Lightbox component
function Lightbox({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  images: ImageItem[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const currentImage = images[currentIndex];
  
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);
  
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      
      {/* Navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
            aria-label="Próxima"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </>
      )}
      
      {/* Image */}
      <img
        src={currentImage.srcDesktop}
        alt={currentImage.alt || 'Imagem'}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Caption and counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        {currentImage.caption && (
          <p className="text-white text-lg mb-2">{currentImage.caption}</p>
        )}
        <p className="text-white/70 text-sm">
          {currentIndex + 1} / {images.length}
        </p>
      </div>
    </div>
  );
}

export default ImageCarouselBlock;
