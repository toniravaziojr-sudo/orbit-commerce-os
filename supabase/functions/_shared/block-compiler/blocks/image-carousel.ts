// =============================================
// IMAGE CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/ImageCarouselBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Supports aspectRatio: 16:9, 4:3, 1:1, 21:9, auto
// - Supports slidesPerView: 1-4
// - Uses <picture> with srcMobile source
// - Rounded corners (rounded-lg)
// - Shows dots when >1 image
// - Mobile: always 1 slide per view
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface ImageItem {
  id?: string;
  srcDesktop?: string;
  src?: string;
  srcMobile?: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
}

const ASPECT_RATIO_MAP: Record<string, string> = {
  '16:9': '16/9',
  '4:3': '4/3',
  '1:1': '1/1',
  '21:9': '21/9',
  'auto': 'auto',
};

export function imageCarouselToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const images = (Array.isArray(props.images) ? props.images : []) as ImageItem[];
  const title = props.title as string || '';
  const aspectRatio = (props.aspectRatio as string) || '16:9';
  const slidesPerView = (props.slidesPerView as number) || 1;
  const showDots = (props.showDots as boolean) ?? true;

  if (images.length === 0) return '';

  const ar = ASPECT_RATIO_MAP[aspectRatio] || '16/9';
  const arStyle = ar === 'auto' ? '' : `aspect-ratio:${ar};`;
  const slideWidth = slidesPerView > 1 ? `${100 / slidesPerView}%` : '100%';

  const imagesHtml = images.map(img => {
    const desktopSrc = img.srcDesktop || img.src || '';
    const src = optimizeImageUrl(desktopSrc, 1200, 85);
    const mobileSrc = img.srcMobile ? optimizeImageUrl(img.srcMobile, 768, 80) : '';
    if (!src) return '';
    
    const wrapperTag = img.linkUrl ? 'a' : 'div';
    const hrefAttr = img.linkUrl ? ` href="${escapeHtml(img.linkUrl)}" target="_blank" rel="noopener noreferrer"` : '';
    
    const pictureHtml = `<picture>
      ${mobileSrc ? `<source media="(max-width: 768px)" srcset="${escapeHtml(mobileSrc)}">` : ''}
      <img src="${escapeHtml(src)}" alt="${escapeHtml(img.alt || img.caption || 'Imagem do carrossel')}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
    </picture>`;
    
    return `<${wrapperTag}${hrefAttr} class="sf-ic-slide" style="flex-shrink:0;min-width:0;overflow:hidden;border-radius:8px;background:#f5f5f5;${arStyle}">
      ${pictureHtml}
    </${wrapperTag}>
    ${img.caption ? `<p style="font-size:14px;color:var(--theme-text-secondary, #6b7280);margin-top:8px;text-align:center;">${escapeHtml(img.caption)}</p>` : ''}`;
  }).join('');

  // Dots (matches React: w-2.5 h-2.5, active gets w-6 with accent color)
  let dotsHtml = '';
  if (showDots && images.length > 1) {
    const dots = images.map((_, idx) => {
      const isActive = idx === 0;
      const w = isActive ? '24px' : '10px';
      const bg = isActive ? 'var(--theme-accent-color, var(--theme-button-primary-bg, #1a1a1a))' : 'rgba(0,0,0,0.2)';
      return `<button style="width:${w};height:10px;border-radius:9999px;border:none;background:${bg};cursor:pointer;transition:all 0.2s;" aria-label="Ir para imagem ${idx + 1}"></button>`;
    }).join('');
    dotsHtml = `<div style="display:flex;justify-content:center;gap:8px;margin-top:16px;">${dots}</div>`;
  }

  return `<section class="sf-ic-section" style="max-width:1280px;margin:0 auto;padding:16px 16px;">
    ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:16px;text-align:center;font-family:var(--sf-heading-font);">${escapeHtml(title)}</h2>` : ''}
    <div style="overflow:hidden;border-radius:8px;">
      <div class="sf-ic-track" style="display:flex;gap:16px;scroll-snap-type:x mandatory;overflow-x:auto;">
        ${imagesHtml}
      </div>
    </div>
    ${dotsHtml}
    <style>
      .sf-ic-slide{width:${slideWidth};scroll-snap-align:start;}
      @media(max-width:639px){
        .sf-ic-section{padding:8px 8px !important;}
        .sf-ic-slide{width:100% !important;}
      }
      @media(min-width:640px) and (max-width:1023px){.sf-ic-slide{width:${slidesPerView > 2 ? '50%' : slideWidth} !important;}}
      .sf-ic-track{scrollbar-width:none;-ms-overflow-style:none;}
      .sf-ic-track::-webkit-scrollbar{display:none;}
    </style>
  </section>`;
}
