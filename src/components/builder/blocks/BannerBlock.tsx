// =============================================
// BANNER BLOCK - Unified banner with single or carousel mode
// Phase 1: Per-slide style, bannerType, hasEditableContent with fallbacks
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getHeroBannerImageUrl } from '@/lib/imageTransform';

interface BannerSlide {
  id: string;
  imageDesktop: string;
  imageMobile?: string;
  linkUrl?: string;
  altText?: string;
  // CTA per slide
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  hasEditableContent?: boolean;
  // Style per slide
  overlayOpacity?: number;
  textColor?: string;
  alignment?: string;
  buttonAlignment?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverBgColor?: string;
  buttonHoverTextColor?: string;
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
  
  // New Phase 1 props
  bannerType?: 'image' | 'solid';
  hasEditableContent?: boolean;
  
  // Style props (block-level defaults)
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverBgColor?: string;
  buttonHoverTextColor?: string;
  alignment?: 'left' | 'center' | 'right';
  buttonAlignment?: 'left' | 'center' | 'right' | 'auto' | '';
  overlayOpacity?: number;
  height?: 'sm' | 'md' | 'lg' | 'full' | 'auto';
  bannerWidth?: 'full' | 'contained';
  layoutPreset?: 'standard' | 'compact-centered' | 'compact-full' | 'large';
  
  // Carousel mode props
  slides?: BannerSlide[];
  autoplaySeconds?: number;
  showArrows?: boolean;
  showDots?: boolean;
  
  // Transient state
  _isRegenerating?: boolean;
  
  // Context
  context?: BlockRenderContext;
}

// ===== Resolve layoutPreset from new prop or legacy height+bannerWidth =====
function resolvePreset(
  layoutPreset?: string,
  height?: string,
  bannerWidth?: string,
): 'standard' | 'compact-centered' | 'compact-full' | 'large' {
  if (layoutPreset && ['standard', 'compact-centered', 'compact-full', 'large'].includes(layoutPreset)) {
    return layoutPreset as 'standard' | 'compact-centered' | 'compact-full' | 'large';
  }
  // Fallback: infer from legacy props
  if (height === 'full' || height === 'lg') return 'large';
  if (height === 'sm' || height === 'md') {
    return bannerWidth === 'contained' ? 'compact-centered' : 'compact-full';
  }
  // height === 'auto' or undefined
  return bannerWidth === 'contained' ? 'compact-centered' : 'standard';
}

// Preset layout config
const PRESET_CONFIG = {
  'standard': {
    useAspect: true,
    fullWidth: true,
    minHeight: undefined as string | undefined,
  },
  'compact-centered': {
    useAspect: false,
    fullWidth: false, // contained on desktop
    minHeight: '300px',
  },
  'compact-full': {
    useAspect: false,
    fullWidth: true,
    minHeight: '300px',
  },
  'large': {
    useAspect: false,
    fullWidth: true,
    minHeight: '100vh',
  },
} as const;

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
  // New props
  bannerType,
  hasEditableContent,
  // Style (block-level defaults)
  backgroundColor,
  textColor = '#ffffff',
  buttonColor = '#ffffff',
  buttonTextColor,
  buttonHoverBgColor,
  buttonHoverTextColor,
  alignment = 'center',
  buttonAlignment,
  overlayOpacity = 0,
  height = 'auto',
  bannerWidth = 'full',
  layoutPreset,
  // Carousel
  slides = [],
  autoplaySeconds = 5,
  showArrows = true,
  showDots = true,
  // Transient
  _isRegenerating,
  // Context
  context,
}: BannerBlockProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const realIsMobile = useIsMobile();
  
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = isBuilderMode 
    ? context.viewport === 'mobile' 
    : realIsMobile;

  // Resolve preset
  const preset = resolvePreset(layoutPreset, height, bannerWidth);
  const presetCfg = PRESET_CONFIG[preset];

  const aspectClass = isBuilderMode
    ? (isMobile ? 'aspect-[4/5]' : 'aspect-[12/5]')
    : 'aspect-[4/5] md:aspect-[12/5]';

  // For compact-centered: contained on desktop, full on mobile
  const widthClass = presetCfg.fullWidth
    ? 'w-full'
    : (isBuilderMode
        ? (isMobile ? 'w-full' : 'max-w-7xl mx-auto')
        : 'w-full md:max-w-7xl md:mx-auto');

  const safeSlides = Array.isArray(slides) ? slides : [];
  const isCarousel = mode === 'carousel' && safeSlides.length > 0;

  // Autoplay
  useEffect(() => {
    if (!isCarousel || safeSlides.length <= 1 || !autoplaySeconds) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeSlides.length);
    }, autoplaySeconds * 1000);
    return () => clearInterval(interval);
  }, [isCarousel, safeSlides.length, autoplaySeconds]);

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

  // ===== Resolve current slide data + per-slide style =====
  const currentSlide = isCarousel ? safeSlides[currentIndex] || safeSlides[0] : null;

  // Content
  const currentTitle = isCarousel ? currentSlide?.title : title;
  const currentSubtitle = isCarousel ? currentSlide?.subtitle : subtitle;
  const currentButtonText = isCarousel ? currentSlide?.buttonText : buttonText;
  const currentButtonUrl = isCarousel ? currentSlide?.buttonUrl : buttonUrl;
  const currentLinkUrl = isCarousel ? currentSlide?.linkUrl : linkUrl;

  // Images — bannerType=solid only applies to single mode
  const isSolidBanner = mode === 'single' && (bannerType === 'solid');
  const rawDesktopImage = isCarousel ? currentSlide?.imageDesktop : imageDesktop;
  const rawMobileImage = isCarousel
    ? (currentSlide?.imageMobile || currentSlide?.imageDesktop)
    : (imageMobile || imageDesktop);
  const effectiveDesktopImage = isSolidBanner ? undefined : rawDesktopImage;
  const effectiveMobileImage = isSolidBanner ? undefined : rawMobileImage;

  // Apply wsrv.nl for public mode
  const currentDesktopImage = isBuilderMode
    ? effectiveDesktopImage
    : (effectiveDesktopImage ? getHeroBannerImageUrl(effectiveDesktopImage, 'desktop') : undefined);
  const currentMobileImage = isBuilderMode
    ? effectiveMobileImage
    : (effectiveMobileImage ? getHeroBannerImageUrl(effectiveMobileImage, 'mobile') : undefined);

  // Per-slide style with fallback to block-level defaults
  const currentOverlayOpacity = isCarousel ? (currentSlide?.overlayOpacity ?? overlayOpacity) : overlayOpacity;
  const currentTextColor = isCarousel ? (currentSlide?.textColor ?? textColor) : textColor;
  const currentAlignment = (isCarousel ? ((currentSlide?.alignment as typeof alignment) ?? alignment) : alignment) || 'center';
  const currentButtonAlignment = isCarousel ? ((currentSlide?.buttonAlignment as typeof buttonAlignment) ?? buttonAlignment) : buttonAlignment;
  const currentButtonColor = isCarousel ? (currentSlide?.buttonColor ?? buttonColor) : buttonColor;
  const currentButtonTextColorVal = isCarousel ? (currentSlide?.buttonTextColor ?? buttonTextColor) : buttonTextColor;
  const currentButtonHoverBg = isCarousel ? (currentSlide?.buttonHoverBgColor ?? buttonHoverBgColor) : buttonHoverBgColor;
  const currentButtonHoverText = isCarousel ? (currentSlide?.buttonHoverTextColor ?? buttonHoverTextColor) : buttonHoverTextColor;

  // hasEditableContent resolution with backward compatibility
  const effectiveHasEditable = (() => {
    if (isCarousel) {
      const slideVal = currentSlide?.hasEditableContent;
      if (slideVal !== undefined) return slideVal;
      // Infer from slide content for old slides
      return !!(currentSlide?.title || currentSlide?.buttonText);
    }
    if (hasEditableContent !== undefined) return hasEditableContent;
    // Infer from props for old banners
    return !!(title || buttonText);
  })();

  const hasCTA = effectiveHasEditable !== false && (currentTitle || currentSubtitle || currentButtonText);

  // ===== Empty state =====
  if (!currentDesktopImage && !backgroundColor) {
    return (
      <div className={cn(
        'relative bg-muted/30 flex items-center justify-center',
        widthClass,
        presetCfg.useAspect ? aspectClass : ''
      )}
      style={{ minHeight: presetCfg.minHeight }}
      >
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Adicione uma imagem para o banner</p>
        </div>
        {_isRegenerating && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">Gerando nova variante...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== Alignment =====
  const alignClass = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[currentAlignment] || 'items-center text-center';

  const effectiveButtonAlignment = (!currentButtonAlignment || currentButtonAlignment === 'auto') ? currentAlignment : currentButtonAlignment;
  const btnAlignClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[effectiveButtonAlignment] || 'justify-center';

  // ===== Button styles =====
  const btnId = `banner-btn-${Math.random().toString(36).substr(2, 9)}`;
  const baseBgColor = currentButtonColor || '#ffffff';
  const baseTextColor = currentButtonTextColorVal || (currentButtonColor ? '#ffffff' : '#1a1a1a');
  const hoverBg = currentButtonHoverBg || baseBgColor;
  const hoverText = currentButtonHoverText || baseTextColor;

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
        {currentDesktopImage && currentOverlayOpacity > 0 && (
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: currentOverlayOpacity / 100 }}
          />
        )}

        {/* CTA Content */}
        {hasCTA && (
          <>
            {currentButtonText && (
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
            )}
            <div
              className={cn(
                "absolute inset-0 flex flex-col z-10",
                isMobile
                  ? 'justify-between'
                  : cn('justify-center', alignClass),
              )}
              style={{
                padding: isMobile ? '32px 20px 28px' : '48px 64px',
                maxWidth: isMobile ? '100%' : (currentAlignment === 'center' ? '100%' : '55%'),
              }}
            >
              {isMobile ? (
                <>
                  {/* Top zone: Title */}
                  <div className="w-full text-center">
                    {currentTitle && (
                      <h2
                        className="font-bold leading-tight"
                        style={{ color: currentTextColor, fontSize: '1.5rem' }}
                      >
                        {currentTitle}
                      </h2>
                    )}
                  </div>
                  {/* Bottom zone: Subtitle + Button */}
                  <div className="w-full flex flex-col items-center text-center">
                    {currentSubtitle && (
                      <p
                        className="opacity-90 leading-snug"
                        style={{ color: currentTextColor, fontSize: '0.875rem', marginBottom: '0.75rem' }}
                      >
                        {currentSubtitle}
                      </p>
                    )}
                    {currentButtonText && (
                      <div className={cn("flex w-full", btnAlignClass)}>
                        {isBuilderMode ? (
                          <span
                            className={`${btnId} inline-block rounded-lg font-semibold transition-colors cursor-pointer`}
                            style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
                          >
                            {currentButtonText}
                          </span>
                        ) : (
                          <a
                            href={currentButtonUrl || '#'}
                            className={`${btnId} inline-block rounded-lg font-semibold transition-colors`}
                            style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
                          >
                            {currentButtonText}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {currentTitle && (
                    <h2
                      className="font-bold leading-tight"
                      style={{ color: currentTextColor, fontSize: '3rem', marginBottom: '1rem' }}
                    >
                      {currentTitle}
                    </h2>
                  )}
                  {currentSubtitle && (
                    <p
                      className="opacity-90 leading-snug"
                      style={{ color: currentTextColor, fontSize: '1.5rem', marginBottom: '2rem' }}
                    >
                      {currentSubtitle}
                    </p>
                  )}
                  {currentButtonText && (
                    <div className={cn("flex w-full", btnAlignClass)}>
                      {isBuilderMode ? (
                        <span
                          className={`${btnId} inline-block rounded-lg font-semibold transition-colors cursor-pointer`}
                          style={{ padding: '1rem 2.5rem', fontSize: '1.125rem' }}
                        >
                          {currentButtonText}
                        </span>
                      ) : (
                        <a
                          href={currentButtonUrl || '#'}
                          className={`${btnId} inline-block rounded-lg font-semibold transition-colors`}
                          style={{ padding: '1rem 2.5rem', fontSize: '1.125rem' }}
                        >
                          {currentButtonText}
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Loading overlay during regeneration */}
        {_isRegenerating && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="text-sm font-medium">Gerando nova variante...</span>
            </div>
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

  // Wrap in link if URL provided (only without CTA, only in public mode)
  if (currentLinkUrl && !hasCTA && !isBuilderMode) {
    return (
      <a href={currentLinkUrl} className="block">
        {bannerContent}
      </a>
    );
  }

  return bannerContent;
}
