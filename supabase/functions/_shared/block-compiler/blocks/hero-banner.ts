// =============================================
// HERO BANNER BLOCK COMPILER
// Mirrors: src/components/builder/blocks/HeroBannerBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Uses <picture> with <source> for mobile
// - aspect-ratio: 4/5 on mobile, 12/5 on desktop (matching BannerBlock)
// - fetchPriority="high", loading="eager" on first slide
// - Shows dots and arrows only when >1 slide
// - Static render: always shows first slide (no carousel JS)
// - Uses unique CSS class per instance to avoid collisions
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface BannerSlide {
  id?: string;
  imageDesktop?: string;
  imageMobile?: string;
  linkUrl?: string;
  altText?: string;
}

export function heroBannerToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const slides = (Array.isArray(props.slides) ? props.slides : []) as BannerSlide[];
  const bannerWidth = (props.bannerWidth as string) || 'full';
  const showDots = (props.showDots as boolean) ?? true;
  
  // Unique ID per instance to avoid CSS class collisions
  const bannerId = 'sf-hb-' + Math.random().toString(36).slice(2, 8);

  if (slides.length === 0) {
    return `<div style="position:relative;background:#f5f5f5;display:flex;align-items:center;justify-content:center;aspect-ratio:12/5;${bannerWidth === 'full' ? 'width:100%;' : 'max-width:1280px;margin:0 auto;'}">
      <p style="color:#999;font-size:14px;">Adicione banners para exibir aqui</p>
    </div>`;
  }

  const currentSlide = slides[0];
  const rawDesktop = (currentSlide.imageDesktop || '').trim();
  const rawMobile = (currentSlide.imageMobile || '').trim() || rawDesktop;
  const effectiveDesktop = rawDesktop || rawMobile;
  const effectiveMobile = rawMobile || rawDesktop;

  // Match React component's image transform
  const desktopImage = optimizeImageUrl(effectiveDesktop, 1920, 85);
  const mobileImage = optimizeImageUrl(effectiveMobile, 768, 80);

  const widthStyle = bannerWidth === 'full' ? 'width:100%;' : 'max-width:1280px;margin:0 auto;';

  // Build dots HTML (matches React: w-2.5 h-2.5 rounded-full, active gets w-6)
  let dotsHtml = '';
  if (showDots && slides.length > 1) {
    const dots = slides.map((_, idx) => {
      const isActive = idx === 0;
      const w = isActive ? '24px' : '10px';
      const bg = isActive ? 'var(--theme-button-primary-bg, #1a1a1a)' : 'rgba(255,255,255,0.6)';
      return `<button style="width:${w};height:10px;border-radius:9999px;border:none;background:${bg};cursor:pointer;transition:all 0.2s;" aria-label="Ir para banner ${idx + 1}"></button>`;
    }).join('');
    dotsHtml = `<div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;">${dots}</div>`;
  }

  // Build image HTML using <picture> (matches React storefront mode)
  let imageHtml = '';
  if (effectiveDesktop) {
    const sourceTag = effectiveMobile && effectiveMobile !== effectiveDesktop
      ? `<source media="(max-width: 767px)" srcset="${escapeHtml(mobileImage)}">`
      : '';
    imageHtml = `<picture>
      ${sourceTag}
      <img src="${escapeHtml(desktopImage)}" alt="${escapeHtml(currentSlide.altText || 'Banner 1')}" style="width:100%;height:100%;object-fit:cover;" fetchpriority="high" decoding="sync" loading="eager" width="1920" height="800">
    </picture>`;
  }

  // Use unique class per instance (avoid sf-hero-banner collision with multiple HeroBanners)
  const content = `<div style="position:relative;overflow:hidden;${widthStyle}">
    <style>.${bannerId}{aspect-ratio:4/5;}@media(min-width:768px){.${bannerId}{aspect-ratio:12/5;}}</style>
    <div class="${bannerId}" style="position:relative;">
      ${imageHtml}
    </div>
    ${dotsHtml}
  </div>`;

  if (currentSlide.linkUrl) {
    return `<a href="${escapeHtml(currentSlide.linkUrl)}" style="display:block;">${content}</a>`;
  }
  return content;
}
