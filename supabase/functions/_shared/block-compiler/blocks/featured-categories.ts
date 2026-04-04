// =============================================
// FEATURED CATEGORIES BLOCK COMPILER
// Mirrors: src/components/builder/blocks/FeaturedCategoriesBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Circular category images with responsive sizes (w-16/w-20/w-24 → 64/80/96px)
// - Ring-2 hover effect on circles
// - Category name below image (showName prop)
// - Flexbox layout: flex-wrap + justify-center (categories always centered)
// - v8.13.0: Migrated from CSS Grid to Flexbox for centered alignment
// - Links to /categoria/{slug}
// - Section padding: py-6 sm:py-8
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
    return `<a href="/categoria/${escapeHtml(cat!.slug)}" class="sf-cat-card" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;cursor:pointer;">
      <div class="sf-cat-circle" style="border-radius:50%;overflow:hidden;background:#f0f0f0;flex-shrink:0;transition:all 0.2s;">
        ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(cat!.name)}" style="width:100%;height:100%;object-fit:cover;transition:transform 0.3s;" loading="lazy">` : ''}
      </div>
      ${showName ? `<span class="sf-cat-name" style="font-weight:500;text-align:center;margin-top:8px;transition:color 0.2s;color:inherit;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(cat!.name)}</span>` : ''}
    </a>`;
  }).join('');

  return `<section style="padding:24px 0 32px;">
    <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
      ${title ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;font-family:var(--sf-heading-font);color:inherit;">${escapeHtml(title)}</h2>
      </div>` : ''}
      <div class="sf-cat-grid" style="display:flex;flex-wrap:wrap;justify-content:center;gap:24px;">
        ${categoryCards}
      </div>
    </div>
    <style>
      .sf-cat-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:24px;}
      .sf-cat-circle{width:64px;height:64px;ring:2px solid transparent;}
      @media(min-width:640px){.sf-cat-circle{width:80px;height:80px;}}
      @media(min-width:768px){.sf-cat-circle{width:96px;height:96px;}}
      .sf-cat-card:hover .sf-cat-circle{box-shadow:0 0 0 2px var(--theme-button-primary-bg,#1a1a1a);}
      .sf-cat-card:hover .sf-cat-circle img{transform:scale(1.1);}
      .sf-cat-card:hover .sf-cat-name{color:var(--theme-button-primary-bg,#1a1a1a);}
      .sf-cat-name{font-size:12px;}
      @media(min-width:640px){.sf-cat-name{font-size:14px;}}
    </style>
  </section>`;
}
