// =============================================
// FEATURED CATEGORIES BLOCK COMPILER
// Mirrors: src/components/builder/blocks/FeaturedCategoriesBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Circular category images (120x120 desktop)
// - Category name below image
// - flex-wrap layout, centered
// - Mobile: carousel mode or grid based on mobileStyle prop
// - Links to /categoria/{slug}
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

interface CategoryItemConfig {
  categoryId: string;
}

export function featuredCategoriesToStaticHTML(
  props: Record<string, unknown>,
  context: CompilerContext,
): string {
  const title = props.title as string || '';
  const items = (Array.isArray(props.items) ? props.items : []) as CategoryItemConfig[];
  const showName = (props.showName as boolean) ?? true;

  if (items.length === 0) return '';

  const validCategories = items
    .map(item => context.categories.get(item.categoryId))
    .filter(Boolean);

  if (validCategories.length === 0) return '';

  const categoryCards = validCategories.map(cat => {
    const imgUrl = optimizeImageUrl(cat!.image_url, 300, 80);
    return `<a href="/categoria/${escapeHtml(cat!.slug)}" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;gap:8px;">
      <div style="width:120px;height:120px;border-radius:50%;overflow:hidden;background:#f0f0f0;flex-shrink:0;">
        ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(cat!.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
      </div>
      ${showName ? `<span style="font-size:14px;font-weight:500;color:var(--theme-text-primary,#1a1a1a);text-align:center;">${escapeHtml(cat!.name)}</span>` : ''}
    </a>`;
  }).join('');

  return `<section style="max-width:1280px;margin:0 auto;padding:32px 16px;">
    ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;font-family:var(--sf-heading-font);color:var(--theme-text-primary,#1a1a1a);">${escapeHtml(title)}</h2>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
      ${categoryCards}
    </div>
  </section>`;
}
