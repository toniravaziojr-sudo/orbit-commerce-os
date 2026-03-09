// =============================================
// TESTIMONIALS BLOCK COMPILER — Customer testimonials
// Mirrors: src/components/builder/blocks/interactive/TestimonialsBlock.tsx
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface TestimonialItem {
  name?: string;
  content?: string;
  text?: string;
  rating?: number;
  role?: string;
  image?: string;
}

export const testimonialsToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || 'O que dizem nossos clientes';
  const rawItems = props.items;
  const items: TestimonialItem[] = Array.isArray(rawItems) ? rawItems : [];

  if (items.length === 0) return '';

  const stars = (n: number) => '⭐'.repeat(Math.min(Math.max(n || 5, 0), 5));

  const cardsHtml = items.map(item => {
    const name = escapeHtml(item.name || '');
    const body = escapeHtml(item.content || item.text || '');
    const role = escapeHtml(item.role || '');
    const imgSrc = item.image ? optimizeImageUrl(item.image, 128) : '';

    return `<div style="padding:1.5rem;border:1px solid #e5e7eb;border-radius:0.5rem;text-align:center;">
  ${imgSrc ? `<img src="${imgSrc}" alt="${name}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto 1rem;" loading="lazy">` : ''}
  <div style="margin-bottom:0.5rem;">${stars(item.rating || 5)}</div>
  <p style="color:#666;margin-bottom:1rem;font-style:italic;">"${body}"</p>
  <p style="font-weight:600;">${name}</p>
  ${role ? `<p style="font-size:0.875rem;color:#888;">${role}</p>` : ''}
</div>`;
  }).join('\n');

  return `<section class="py-8" style="max-width:1200px;margin:0 auto;padding-left:16px;padding-right:16px;">
  ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem;text-align:center;">${escapeHtml(title)}</h2>` : ''}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem;">${cardsHtml}</div>
</section>`;
};
