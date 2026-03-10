// =============================================
// IMAGE GALLERY BLOCK COMPILER
// Mirrors: src/components/builder/blocks/ImageGalleryBlock.tsx
// Responsive grid with optional lightbox via JS hydration
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface GalleryImage {
  id?: string;
  src?: string;
  alt?: string;
  caption?: string;
}

const aspectCss: Record<string, string> = {
  square: 'aspect-ratio:1/1;',
  '4:3': 'aspect-ratio:4/3;',
  '16:9': 'aspect-ratio:16/9;',
  auto: '',
};

const gapPx: Record<string, string> = { sm: '0.5rem', md: '1rem', lg: '1.5rem' };

export const imageGalleryToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const subtitle = (props.subtitle as string) || '';
  const rawImages = props.images;
  const images: GalleryImage[] = Array.isArray(rawImages) ? rawImages : [];
  const columns = (props.columns as number) || 3;
  const gap = (props.gap as string) || 'md';
  const aspectRatio = (props.aspectRatio as string) || 'square';
  const borderRadius = (props.borderRadius as number) ?? 8;
  const backgroundColor = (props.backgroundColor as string) || 'transparent';

  if (images.length === 0) return '';

  const gapVal = gapPx[gap] || gapPx.md;
  const aspect = aspectCss[aspectRatio] || aspectCss.square;

  const imagesHtml = images.map((img, i) => {
    const src = optimizeImageUrl(img.src, 600);
    if (!src) return '';
    const alt = escapeHtml(img.alt || `Imagem ${i + 1}`);
    const caption = img.caption ? `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);padding:0.75rem;transform:translateY(100%);transition:transform .3s;" class="sf-gallery-caption"><p style="color:#fff;font-size:0.875rem;">${escapeHtml(img.caption)}</p></div>` : '';
    return `<div style="position:relative;overflow:hidden;border-radius:${borderRadius}px;cursor:pointer;" class="sf-gallery-item" data-sf-gallery-idx="${i}">
  <img src="${src}" alt="${alt}" loading="lazy" style="width:100%;height:100%;object-fit:cover;${aspect}transition:transform .3s;">
  ${caption}
</div>`;
  }).filter(Boolean).join('\n');

  const headerHtml = (title || subtitle) ? `<div style="text-align:center;margin-bottom:2rem;">
  ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
  ${subtitle ? `<p style="color:var(--theme-text-secondary, #888);">${escapeHtml(subtitle)}</p>` : ''}
</div>` : '';

  return `<section style="padding:2.5rem 1rem;background:${backgroundColor};">
  <div style="max-width:72rem;margin:0 auto;">
    ${headerHtml}
    <div style="display:grid;grid-template-columns:repeat(${Math.min(columns, 2)},1fr);gap:${gapVal};" class="sf-gallery-grid">
      ${imagesHtml}
    </div>
  </div>
  <style>
    @media(min-width:768px){.sf-gallery-grid{grid-template-columns:repeat(${columns},1fr)!important}}
    .sf-gallery-item:hover img{transform:scale(1.05)}
    .sf-gallery-item:hover .sf-gallery-caption{transform:translateY(0)!important}
  </style>
</section>`;
};
