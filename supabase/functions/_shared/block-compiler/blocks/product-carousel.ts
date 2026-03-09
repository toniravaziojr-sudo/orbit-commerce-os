// =============================================
// PRODUCT CAROUSEL BLOCK COMPILER
// Mirrors: src/components/builder/blocks/ProductCarouselBlock.tsx
// Renders products in a horizontal scrollable layout
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';
import { renderProductCard } from './shared/product-card-html.ts';

export const productCarouselToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const source = (props.source as string) || 'featured';
  const categoryId = props.categoryId as string || '';
  const limit = (props.limit as number) || 8;
  const showPrice = (props.showPrice as boolean) ?? true;

  // Gather products from context
  let products: Array<{ id: string; name: string; slug: string; price: number; compare_at_price?: number; free_shipping?: boolean; avg_rating?: number; review_count?: number; image_url?: string }> = [];

  if (source === 'category' && categoryId && context.categoryProducts) {
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

  const cardsHtml = products.map(p => 
    `<div class="sf-pcar-item" style="flex:0 0 auto;width:220px;min-width:0;">${renderProductCard(p, context, cs, showPrice)}</div>`
  ).join('');

  // Carousel nav arrows SVG
  const arrowLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
  const arrowRight = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;

  return `<section class="sf-pcar-section" style="padding:32px 16px;" data-sf-product-carousel>
    <div style="max-width:1280px;margin:0 auto;position:relative;">
      ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;color:inherit;">${escapeHtml(title)}</h2>` : ''}
      <div class="sf-pcar-track" style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:8px;">
        ${cardsHtml}
      </div>
      ${products.length > 4 ? `
        <button class="sf-pcar-prev" style="display:none;position:absolute;top:50%;left:-16px;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);border:none;cursor:pointer;align-items:center;justify-content:center;z-index:2;">${arrowLeft}</button>
        <button class="sf-pcar-next" style="display:none;position:absolute;top:50%;right:-16px;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);border:none;cursor:pointer;align-items:center;justify-content:center;z-index:2;">${arrowRight}</button>
      ` : ''}
    </div>
    <style>
      .sf-pcar-track::-webkit-scrollbar{display:none;}
      .sf-pcar-item{scroll-snap-align:start;}
      @media(min-width:769px){
        .sf-pcar-prev,.sf-pcar-next{display:flex !important;}
        .sf-pcar-item{width:calc(25% - 12px) !important;}
      }
      @media(max-width:768px){
        .sf-pcar-section{padding:16px 8px !important;}
        .sf-pcar-item{width:160px !important;}
        .sf-pcar-track{gap:8px !important;}
      }
    </style>
  </section>`;
};
