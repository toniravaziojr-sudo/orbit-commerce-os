// =============================================
// BANNER BLOCK - Unified banner with single or carousel mode
// Combines Hero (single banner with CTA) and HeroBanner (carousel)
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getHeroBannerImageUrl } from '@/lib/imageTransform';

interface BannerSlide {
  id: string;
  imageDesktop: string;
  imageMobile?: string;
  linkUrl?: string;
  altText?: string;
  // CTA overlay props (optional per slide)
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
}

interface BannerBlockProps {
  // Mode
  mode?: 'single' | 'carousel';
  
  // Single mode props
  imageDesktop?: string;
  imageMobile?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  linkUrl?: string;
  
  // Style props
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverBgColor?: string;
  buttonHoverTextColor?: string;
  alignment?: 'left' | 'center' | 'right';
  overlayOpacity?: number;
  height?: 'sm' | 'md' | 'lg' | 'full' | 'auto';
  bannerWidth?: 'full' | 'contained';
  
  // Carousel mode props
  slides?: BannerSlide[];
  autoplaySeconds?: number;
  showArrows?: boolean;
  showDots?: boolean;
  
  // Context
  context?: BlockRenderContext;
}

const heightMap: Record<string, string> = {
  sm: '300px',
  md: '400px',
  lg: '500px',
  full: '100vh',
  auto: 'auto',
};

export function BannerBlock({
  mode = 'single',
  // Single mode
  imageDesktop,
  imageMobile,
  title,
  subtitle,
  buttonText,
  buttonUrl,
  linkUrl,
  // Style
  backgroundColor,
  textColor = '#ffffff',
  buttonColor = '#ffffff',
  buttonTextColor,
  buttonHoverBgColor,
  buttonHoverTextColor,
  alignment = 'center',
  overlayOpacity = 0,
  height = 'auto',
  bannerWidth = 'full',
  // Carousel
  slides = [],
  autoplaySeconds = 5,
  showArrows = true,
  showDots = true,
  // Context
  context,
}: BannerBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const realIsMobile = useIsMobile();
  
  // Builder mode: use context.viewport state; Storefront: use real viewport
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = isBuilderMode 
    ? context.viewport === 'mobile' 
    : realIsMobile;

  // Aspect ratio: in builder mode use explicit viewport state; in storefront use CSS media query
  const aspectClass = isBuilderMode
    ? (isMobile ? 'aspect-[4/5]' : 'aspect-[12/5]')
    : 'aspect-[4/5] md:aspect-[12/5]';

  // Safe slides array
  const safeSlides = Array.isArray(slides) ? slides : [];
  const isCarousel = mode === 'carousel' && safeSlides.length > 0;

  // Autoplay for carousel
  useEffect(() => {
    if (!isCarousel || safeSlides.length <= 1 || !autoplaySeconds) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
    }, autoplaySeconds * 1000);

    return () => clearInterval(interval);
  }, [isCarousel, safeSlides.length, autoplaySeconds]);

  // Reset index if out of bounds
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

  // Get current slide data
  const currentSlide = isCarousel ? safeSlides[currentIndex] || safeSlides[0] : null;
  const rawDesktopImage = isCarousel ? currentSlide?.imageDesktop : imageDesktop;
  const rawMobileImage = isCarousel 
    ? (currentSlide?.imageMobile || currentSlide?.imageDesktop) 
    : (imageMobile || imageDesktop);
  const currentTitle = isCarousel ? currentSlide?.title : title;
  const currentSubtitle = isCarousel ? currentSlide?.subtitle : subtitle;
  const currentButtonText = isCarousel ? currentSlide?.buttonText : buttonText;
  const currentButtonUrl = isCarousel ? currentSlide?.buttonUrl : buttonUrl;
  const currentLinkUrl = isCarousel ? currentSlide?.linkUrl : linkUrl;

  // Apply wsrv.nl transform for public mode (matches LcpPreloader URLs)
  const currentDesktopImage = isBuilderMode 
    ? rawDesktopImage 
    : (rawDesktopImage ? getHeroBannerImageUrl(rawDesktopImage, 'desktop') : undefined);
  const currentMobileImage = isBuilderMode 
    ? rawMobileImage 
    : (rawMobileImage ? getHeroBannerImageUrl(rawMobileImage, 'mobile') : undefined);

  // Empty state
  if (!currentDesktopImage && !backgroundColor) {
    return (
      <div className={cn(
        'relative bg-muted/30 flex items-center justify-center',
        bannerWidth === 'full' ? 'w-full' : 'max-w-7xl mx-auto',
        height === 'auto' ? aspectClass : ''
      )}
      style={{ minHeight: height !== 'auto' ? heightMap[height] : undefined }}
      >
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Adicione uma imagem para o banner</p>
        </div>
      </div>
    );
  }

  // Alignment classes
  const alignClass = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[alignment] || 'items-center text-center';

  // Button styles
  const btnId = `banner-btn-${Math.random().toString(36).substr(2, 9)}`;
  const baseBgColor = buttonColor || '#ffffff';
  const baseTextColor = buttonTextColor || (buttonColor ? '#ffffff' : '#1a1a1a');
  const hoverBg = buttonHoverBgColor || baseBgColor;
  const hoverText = buttonHoverTextColor || baseTextColor;

  const hasCTA = currentTitle || currentSubtitle || currentButtonText;

  const bannerContent = (
    <div 
      className={cn(
        'relative overflow-hidden',
        bannerWidth === 'full' ? 'w-full' : 'max-w-7xl mx-auto'
      )}
      style={{ 
        backgroundColor: currentDesktopImage ? undefined : (backgroundColor || '#f3f4f6'),
        minHeight: height !== 'auto' ? heightMap[height] : undefined,
      }}
    >
      {/* Background Image */}
      <div className={cn(
        'relative',
        height === 'auto' ? aspectClass : 'w-full h-full'
      )}
      style={{ minHeight: height !== 'auto' ? heightMap[height] : undefined }}
      >
        {currentDesktopImage ? (
          isBuilderMode ? (
            <img
              src={isMobile && currentMobileImage ? currentMobileImage : currentDesktopImage}
              alt={currentSlide?.altText || currentTitle || 'Banner'}
              className="w-full h-full object-cover"
            />
          ) : (
            <picture className="block w-full h-full">
              {currentMobileImage && currentMobileImage !== currentDesktopImage && (
                <source media="(max-width: 767px)" srcSet={currentMobileImage} />
              )}
              <img
                src={currentDesktopImage}
                alt={currentSlide?.altText || currentTitle || 'Banner'}
                className="w-full h-full object-cover"
                fetchPriority="high"
                decoding="async"
                width={1920}
                height={800}
              />
            </picture>
          )
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: backgroundColor || '#f3f4f6' }} />
        )}

        {/* Overlay */}
        {currentDesktopImage && overlayOpacity > 0 && (
          <div 
            className="absolute inset-0 bg-black" 
            style={{ opacity: overlayOpacity / 100 }} 
          />
        )}

        {/* CTA Content */}
        {hasCTA && (
          <div className={cn(
            "absolute inset-0 flex flex-col justify-center px-5 md:px-16 py-8 md:py-12 z-10",
            alignClass,
          )}
          style={{ maxWidth: isMobile ? '100%' : (alignment === 'center' ? '100%' : '55%') }}
          >
            {currentTitle && (
              <h2 
                className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-2 md:mb-4 leading-tight"
                style={{ color: textColor }}
              >
                {currentTitle}
              </h2>
            )}
            {currentSubtitle && (
              <p 
                className="text-sm sm:text-base md:text-2xl mb-4 md:mb-8 opacity-90 leading-snug"
                style={{ color: textColor }}
              >
                {currentSubtitle}
              </p>
            )}
            {currentButtonText && (
              <>
                <style>{`
                  .${btnId} {
                    background-color: ${baseBgColor};
                    color: ${baseTextColor};
                  }
                  .${btnId}:hover {
                    background-color: ${hoverBg};
                    color: ${hoverText};
                  }
                `}</style>
                {isBuilderMode ? (
                  <span 
                    className={`${btnId} inline-block px-6 md:px-10 py-3 md:py-4 rounded-lg font-semibold text-sm md:text-lg transition-colors cursor-pointer`}
                  >
                    {currentButtonText}
                  </span>
                ) : (
                  <a 
                    href={currentButtonUrl || '#'} 
                    className={`${btnId} inline-block px-10 py-4 rounded-lg font-semibold text-lg transition-colors`}
                  >
                    {currentButtonText}
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Carousel Navigation */}
      {isCarousel && showArrows && safeSlides.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); goToPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background shadow-lg transition-all z-20"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); goToNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background shadow-lg transition-all z-20"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Carousel Dots */}
      {isCarousel && showDots && safeSlides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {safeSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.preventDefault(); setCurrentIndex(idx); }}
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

  // Wrap in link if URL provided (only for single mode or carousel slide without CTA)
  // In builder mode, never navigate — clicking should select the block for editing
  if (currentLinkUrl && !hasCTA && !isBuilderMode) {
    return (
      <a href={currentLinkUrl} className="block">
        {bannerContent}
      </a>
    );
  }

  return bannerContent;
}
