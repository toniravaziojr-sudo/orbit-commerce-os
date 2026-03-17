// =============================================
// HERO BANNER BLOCK COMPILER — Legacy Delegation
// Delegates to unified Banner compiler (banner.ts) with adapted props.
// Maintains backward compatibility for blocks saved as type "HeroBanner".
// =============================================

import type { CompilerContext } from '../types.ts';
import { bannerToStaticHTML } from './banner.ts';

interface BannerSlide {
  id?: string;
  imageDesktop?: string;
  imageMobile?: string;
  linkUrl?: string;
  altText?: string;
}

export function heroBannerToStaticHTML(
  props: Record<string, unknown>,
  context: CompilerContext,
): string {
  const slides = (Array.isArray(props.slides) ? props.slides : []) as BannerSlide[];
  const bannerWidth = (props.bannerWidth as string) || 'full';
  const showDots = (props.showDots as boolean) ?? true;
  const showArrows = (props.showArrows as boolean) ?? true;
  const autoplaySeconds = (props.autoplaySeconds as number) || 5;
  const layoutPreset = (props.layoutPreset as string) || '';

  // Adapt HeroBanner props to unified Banner format
  const adaptedProps: Record<string, unknown> = {
    ...props,
    // HeroBanner is always carousel-like (image-only slides, no CTA)
    mode: slides.length > 1 ? 'carousel' : 'single',
    bannerType: 'image',
    hasEditableContent: false,
    // Map first slide images to top-level for single mode
    imageDesktop: slides[0]?.imageDesktop || '',
    imageMobile: slides[0]?.imageMobile || slides[0]?.imageDesktop || '',
    linkUrl: slides[0]?.linkUrl || '',
    // Carousel props
    slides: slides.map(s => ({
      ...s,
      imageDesktop: s.imageDesktop || '',
      imageMobile: s.imageMobile || s.imageDesktop || '',
      hasEditableContent: false,
    })),
    autoplaySeconds,
    showDots,
    showArrows,
    // Preserve layout props for resolvePreset fallback
    bannerWidth,
    layoutPreset: layoutPreset || undefined,
    // Ensure overlay is passed through
    overlayOpacity: (props.overlayOpacity as number) || 0,
  };

  return bannerToStaticHTML(adaptedProps, context);
}
