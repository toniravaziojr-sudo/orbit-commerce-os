// =============================================
// COLLECTION SECTION BLOCK COMPILER
// Mirrors: src/components/builder/blocks/CollectionSectionBlock.tsx
// Category section with title + "Ver todos" link + products grid/carousel
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';
import { renderProductCard } from './shared/product-card-html.ts';

export const collectionSectionToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const title = (props.title as string) || 'Nome da coleção';
  const categorySlug = (props.categorySlug as string) || '';
  const categoryId = (props.categoryId as string) || '';
  const displayStyle = (props.displayStyle as string) || 'grid';
  const limit = (props.limit as number) || 8;
  const mobileColumns = (props.mobileColumns as number) || 2;
  const showViewAll = (props.showViewAll as boolean) ?? true;
  const showPrice = (props.showPrice as boolean) ?? true;

  // Gather products from context
  let products: Array<{ id: string; name: string; slug: string; price: number; compare_at_price?: number; free_shipping?: boolean; avg_rating?: number; review_count?: number; image_url?: string }> = [];

  // Try category products first, fall back to all products in context
  if (categoryId && context.categoryProducts) {
    products = context.categoryProducts.map(p => ({
      ...p,
      compare_at_price: p.compare_at_price ?? undefined,
      image_url: p.product_images?.find(i => i.is_primary)?.url || p.product_images?.[0]?.url,
    }));
  } else {
    for (const [id, p] of context.products) {
      products.push({ ...p, image_url: context.productImages.get(id) || '' });
    }
  }

  products = products.slice(0, limit);
  if (products.length === 0) return '';

  const cs = context.categorySettings || {};
  const viewAllUrl = categorySlug ? `/categoria/${escapeHtml(categorySlug)}` : '#';

  const viewAllHtml = showViewAll && categorySlug
    ? `<a href="${viewAllUrl}" style="color:var(--theme-text-secondary, #888);text-decoration:none;display:flex;align-items:center;gap:4px;transition:color .2s;" onmouseover="this.style.color='var(--theme-button-primary-bg,#1a1a1a)'" onmouseout="this.style.color='var(--theme-text-secondary,#888)'">Ver todos <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></a>`
    : '';

  if (displayStyle === 'carousel') {
    const cardsHtml = products.map(p =>
      `<div class="sf-cs-item" style="flex:0 0 auto;width:220px;min-width:0;">${renderProductCard(p, context, cs, showPrice)}</div>`
    ).join('');

    return `<section class="sf-cs-section" style="padding:32px 0;">
      <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
          <h2 style="font-size:1.5rem;font-weight:700;color:inherit;">${escapeHtml(title)}</h2>
          ${viewAllHtml}
        </div>
        <div class="sf-cs-track" style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:8px;">
          ${cardsHtml}
        </div>
      </div>
      <style>
        .sf-cs-track::-webkit-scrollbar{display:none;}
        .sf-cs-item{scroll-snap-align:start;}
        @media(min-width:769px){.sf-cs-item{width:calc(25% - 12px) !important;}}
        @media(max-width:768px){.sf-cs-section{padding:16px 0 !important;}.sf-cs-item{width:160px !important;}.sf-cs-track{gap:8px !important;}}
      </style>
    </section>`;
  }

  // Grid layout (default)
  const cardsHtml = products.map(p => renderProductCard(p, context, cs, showPrice)).join('');

  return `<section class="sf-cs-section" style="padding:32px 0;">
    <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        <h2 style="font-size:1.5rem;font-weight:700;color:inherit;">${escapeHtml(title)}</h2>
        ${viewAllHtml}
      </div>
      <div class="sf-cs-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        ${cardsHtml}
      </div>
    </div>
    <style>
      @media(max-width:768px){
        .sf-cs-section{padding:16px 0 !important;}
        .sf-cs-grid{grid-template-columns:repeat(${mobileColumns},1fr) !important;gap:8px !important;}
      }
    </style>
  </section>`;
};
