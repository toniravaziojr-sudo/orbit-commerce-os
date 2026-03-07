// =============================================
// IMAGE CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/ImageCarouselBlock.tsx
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

export function imageCarouselToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const images = (Array.isArray(props.images) ? props.images : []) as ImageItem[];
  const title = props.title as string || '';

  if (images.length === 0) return '';

  const imagesHtml = images.map(img => {
    const src = optimizeImageUrl(img.srcDesktop || img.src || '', 1200, 85);
    if (!src) return '';
    const wrapperTag = img.linkUrl ? 'a' : 'div';
    const hrefAttr = img.linkUrl ? ` href="${escapeHtml(img.linkUrl)}"` : '';
    return `<${wrapperTag}${hrefAttr} style="flex-shrink:0;width:100%;">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(img.alt || img.caption || '')}" style="width:100%;height:auto;display:block;border-radius:8px;" loading="lazy">
    </${wrapperTag}>`;
  }).join('');

  return `<section style="max-width:1280px;margin:0 auto;padding:32px 16px;">
    ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;font-family:var(--sf-heading-font);">${escapeHtml(title)}</h2>` : ''}
    <div style="display:flex;overflow-x:auto;gap:16px;scroll-snap-type:x mandatory;">
      ${imagesHtml}
    </div>
  </section>`;
}
