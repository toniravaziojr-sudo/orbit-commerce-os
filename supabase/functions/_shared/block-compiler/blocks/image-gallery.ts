// =============================================
// IMAGE GALLERY BLOCK COMPILER (UNIFIED)
// Mirrors: src/components/builder/blocks/image-gallery/ImageGalleryBlock.tsx
// Supports both grid and carousel layouts
// =============================================
// Hydration contract (vanilla JS in storefront-html):
//   CAROUSEL navigation:
//     data-sf-ig-carousel              — section container (carousel mode)
//     data-sf-slides-per-view="N"      — items visible simultaneously
//     data-sf-carousel-track           — flex track (translateX)
//     data-sf-carousel-prev/next       — arrow buttons
//     data-sf-carousel-dots            — dot container
//     data-sf-dot="N"                  — individual dot
//   LIGHTBOX: DISABLED — images are display-only (no click-to-open behaviour)
// v2.3.0: Removed lightbox triggers (data-sf-gallery-idx, cursor:pointer, data-sf-enable-lightbox)
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface GalleryImage {
  id?: string;
  src?: string;
  srcDesktop?: string;
  srcMobile?: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
}

// ── Shared constants ──

const ASPECT_CSS: Record<string, string> = {
  square: 'aspect-ratio:1/1;',
  '1:1': 'aspect-ratio:1/1;',
  '4:3': 'aspect-ratio:4/3;',
  '16:9': 'aspect-ratio:16/9;',
  '21:9': 'aspect-ratio:21/9;',
  auto: '',
};

const GAP_PX: Record<string, string> = { sm: '0.5rem', md: '1rem', lg: '1.5rem' };

// ── Normalize image (retrocompatibility) ──

function normalizeImage(img: GalleryImage): { src: string; srcMobile: string; alt: string; caption: string; linkUrl: string } {
  return {
    src: img.src || img.srcDesktop || '',
    srcMobile: img.srcMobile || '',
    alt: img.alt || '',
    caption: img.caption || '',
    linkUrl: img.linkUrl || '',
  };
}

// ── Header HTML ──

function buildHeaderHtml(title: string, subtitle: string): string {
  if (!title && !subtitle) return '';
  return `<div style="text-align:center;margin-bottom:2rem;">
  ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
  ${subtitle ? `<p style="color:var(--theme-text-secondary, #888);">${escapeHtml(subtitle)}</p>` : ''}
</div>`;
}

// ── Image card HTML ──

function buildImageHtml(img: GalleryImage, index: number, aspect: string, borderRadius: number, isCarousel: boolean, enableLightbox: boolean): string {
  const n = normalizeImage(img);
  const src = optimizeImageUrl(n.src, isCarousel ? 1200 : 600);
  if (!src) return '';
  const mobileSrc = n.srcMobile ? optimizeImageUrl(n.srcMobile, 768, 80) : '';
  const alt = escapeHtml(n.alt || `Imagem ${index + 1}`);

  const pictureHtml = `<picture>
    ${mobileSrc ? `<source media="(max-width: 768px)" srcset="${escapeHtml(mobileSrc)}">` : ''}
    <img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" style="width:100%;height:100%;object-fit:cover;${aspect}transition:transform .3s;">
  </picture>`;

  const captionHtml = n.caption
    ? isCarousel
      ? `<p style="font-size:14px;color:var(--theme-text-secondary, #6b7280);margin-top:8px;text-align:center;">${escapeHtml(n.caption)}</p>`
      : `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);padding:0.75rem;transform:translateY(100%);transition:transform .3s;" class="sf-ig-caption"><p style="color:#fff;font-size:0.875rem;">${escapeHtml(n.caption)}</p></div>`
    : '';

  const wrapperTag = n.linkUrl ? 'a' : 'div';
  const hrefAttr = n.linkUrl ? ` href="${escapeHtml(n.linkUrl)}" target="_blank" rel="noopener noreferrer"` : '';
  // Lightbox DISABLED — images are display-only (no interactive click)
  const lightboxAttr = '';
  const cursorStyle = '';

  if (isCarousel) {
    return `<${wrapperTag}${hrefAttr}${lightboxAttr} class="sf-ig-slide" style="flex-shrink:0;min-width:0;overflow:hidden;border-radius:${borderRadius}px;background:#f5f5f5;${cursorStyle}${aspect}">
      ${pictureHtml}
    </${wrapperTag}>
    ${captionHtml}`;
  }

  return `<${wrapperTag}${hrefAttr}${lightboxAttr} style="position:relative;overflow:hidden;border-radius:${borderRadius}px;${cursorStyle}" class="sf-ig-item">
  ${pictureHtml}
  ${captionHtml}
</${wrapperTag}>`;
}

// ── Grid layout HTML ──

function buildGridHtml(images: GalleryImage[], columns: number, gapVal: string, aspect: string, borderRadius: number, enableLightbox: boolean): string {
  const imagesHtml = images.map((img, i) => buildImageHtml(img, i, aspect, borderRadius, false, enableLightbox)).filter(Boolean).join('\n');

  return `<div style="display:grid;grid-template-columns:repeat(${Math.min(columns, 2)},1fr);gap:${gapVal};" class="sf-ig-grid">
      ${imagesHtml}
    </div>
    <style>
      @media(min-width:768px){.sf-ig-grid{grid-template-columns:repeat(${columns},1fr)!important}}
      .sf-ig-item:hover img{transform:scale(1.05)}
      .sf-ig-item:hover .sf-ig-caption{transform:translateY(0)!important}
    </style>`;
}

// ── Carousel layout HTML ──

function buildCarouselHtml(
  images: GalleryImage[],
  slidesPerView: number,
  gapVal: string,
  aspect: string,
  borderRadius: number,
  showArrows: boolean,
  showDots: boolean,
  enableLightbox: boolean,
): string {
  const slideWidth = slidesPerView > 1 ? `${100 / slidesPerView}%` : '100%';
  const imagesHtml = images.map((img, i) => buildImageHtml(img, i, aspect, borderRadius, true, enableLightbox)).filter(Boolean).join('');
  const needsNav = images.length > slidesPerView;

  // Arrows
  const arrowsHtml = needsNav && showArrows
    ? `<button data-sf-carousel-prev style="position:absolute;left:0.5rem;top:50%;transform:translateY(-50%);width:2.5rem;height:2.5rem;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
  </button>
  <button data-sf-carousel-next style="position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);width:2.5rem;height:2.5rem;border-radius:50%;background:rgba(255,255,255,0.9);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
  </button>`
    : '';

  // Dots — one per valid snap position (total - perSlide + 1), matching Embla behaviour
  let dotsHtml = '';
  if (showDots && needsNav) {
    const dotCount = Math.max(0, images.length - slidesPerView) + 1;
    const dots = Array.from({ length: dotCount }).map((_, idx) => {
      const isActive = idx === 0;
      const w = isActive ? '24px' : '10px';
      const bg = isActive ? 'var(--theme-accent-color, var(--theme-button-primary-bg, #1a1a1a))' : 'rgba(0,0,0,0.2)';
      return `<button data-sf-dot="${idx}" style="width:${w};height:10px;border-radius:9999px;border:none;background:${bg};cursor:pointer;transition:all 0.2s;" aria-label="Ir para posição ${idx + 1}"></button>`;
    }).join('');
    dotsHtml = `<div style="display:flex;justify-content:center;gap:8px;margin-top:16px;" data-sf-carousel-dots>${dots}</div>`;
  }

  return `<div style="position:relative;">
      <div style="overflow:hidden;border-radius:8px;" data-sf-carousel-viewport>
        <div class="sf-ig-track" data-sf-carousel-track style="display:flex;gap:${gapVal};transition:transform 0.3s ease;">
          ${imagesHtml}
        </div>
      </div>
      ${arrowsHtml}
    </div>
    ${dotsHtml}
    <style>
      .sf-ig-slide{width:${slideWidth};scroll-snap-align:start;}
      @media(max-width:639px){.sf-ig-slide{width:100% !important;}}
      @media(min-width:640px) and (max-width:1023px){.sf-ig-slide{width:${slidesPerView > 2 ? '50%' : slideWidth} !important;}}
    </style>`;
}

// ── Main compiler ──

export const imageGalleryToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const subtitle = (props.subtitle as string) || '';
  const rawImages = props.images;
  const images: GalleryImage[] = Array.isArray(rawImages) ? rawImages : [];
  const layout = (props.layout as string) || 'grid';
  const columns = (props.columns as number) || 3;
  const gap = (props.gap as string) || 'md';
  const aspectRatio = (props.aspectRatio as string) || 'square';
  const borderRadius = (props.borderRadius as number) ?? 8;
  const backgroundColor = (props.backgroundColor as string) || 'transparent';
  const slidesPerView = (props.slidesPerView as number) || 1;
  const showArrows = (props.showArrows as boolean) ?? true;
  const showDots = (props.showDots as boolean) ?? true;
  const enableLightbox = (props.enableLightbox as boolean) ?? true;

  if (images.length === 0) return '';

  const gapVal = GAP_PX[gap] || GAP_PX.md;
  const aspect = ASPECT_CSS[aspectRatio] || ASPECT_CSS.square;
  const headerHtml = buildHeaderHtml(title, subtitle);

  const dataAttr = layout === 'carousel' ? ' data-sf-ig-carousel' : ' data-sf-ig-grid';
  const slidesAttr = layout === 'carousel' ? ` data-sf-slides-per-view="${slidesPerView}"` : '';
  // Lightbox DISABLED — no section-level lightbox attribute
  const lightboxAttr = '';

  const contentHtml = layout === 'carousel'
    ? buildCarouselHtml(images, slidesPerView, gapVal, aspect, borderRadius, showArrows, showDots, enableLightbox)
    : buildGridHtml(images, columns, gapVal, aspect, borderRadius, enableLightbox);

  return `<section${dataAttr}${slidesAttr}${lightboxAttr} style="padding:2.5rem 1rem;background:${backgroundColor};">
  <div style="max-width:72rem;margin:0 auto;">
    ${headerHtml}
    ${contentHtml}
  </div>
</section>`;
};
