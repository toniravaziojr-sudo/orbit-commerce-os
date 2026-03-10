// =============================================
// LOGOS CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/LogosCarouselBlock.tsx
// Responsive grid of partner/brand logos
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface Logo {
  id?: string;
  imageUrl: string;
  alt?: string;
  linkUrl?: string;
}

export const logosCarouselToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const subtitle = (props.subtitle as string) || '';
  const logos = (props.logos as Logo[]) || [];
  const grayscale = props.grayscale !== false;
  const columns = (props.columns as number) || 5;
  const backgroundColor = (props.backgroundColor as string) || 'transparent';
  const padding = (props.padding as string) || 'md';

  const paddingMap: Record<string, string> = {
    sm: 'padding:1.5rem 1rem;',
    md: 'padding:2.5rem 1rem;',
    lg: 'padding:3.5rem 1rem;',
  };

  if (logos.length === 0) return '';

  const grayscaleStyle = grayscale
    ? 'filter:grayscale(1);opacity:0.6;transition:all 0.3s;'
    : 'transition:all 0.3s;';

  const logosHtml = logos.map((logo, i) => {
    const imgSrc = optimizeImageUrl(logo.imageUrl, 200, 85);
    const alt = escapeHtml(logo.alt || `Logo ${i + 1}`);
    const img = `<img src="${imgSrc}" alt="${alt}" style="max-height:4rem;width:auto;object-fit:contain;${grayscaleStyle}" loading="lazy" />`;

    if (logo.linkUrl) {
      return `<a href="${escapeHtml(logo.linkUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;">${img}</a>`;
    }
    return `<div>${img}</div>`;
  }).join('');

  const headerHtml = (title || subtitle) ? `
    <div style="text-align:center;margin-bottom:2rem;">
      ${title ? `<h2 style="font-size:1.25rem;font-weight:600;color:inherit;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
      ${subtitle ? `<p style="color:var(--theme-text-secondary, #666);font-size:0.875rem;">${escapeHtml(subtitle)}</p>` : ''}
    </div>` : '';

  return `
    <section style="background-color:${backgroundColor};${paddingMap[padding] || paddingMap.md}">
      <div style="max-width:72rem;margin:0 auto;">
        ${headerHtml}
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem;align-items:center;justify-items:center;" class="sf-logos-grid sf-logos-cols-${columns}">
          ${logosHtml}
        </div>
      </div>
    </section>
    <style>
      @media(min-width:640px){.sf-logos-cols-5{grid-template-columns:repeat(3,1fr)}.sf-logos-cols-6{grid-template-columns:repeat(3,1fr)}.sf-logos-cols-3{grid-template-columns:repeat(3,1fr)}.sf-logos-cols-4{grid-template-columns:repeat(4,1fr)}}
      @media(min-width:768px){.sf-logos-cols-5{grid-template-columns:repeat(5,1fr)}.sf-logos-cols-6{grid-template-columns:repeat(6,1fr)}.sf-logos-cols-3{grid-template-columns:repeat(3,1fr)}.sf-logos-cols-4{grid-template-columns:repeat(4,1fr)}}
    </style>`;
};
