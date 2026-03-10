// =============================================
// PRODUCT GRID BLOCK COMPILER
// Mirrors: src/components/builder/blocks/ProductGridBlock.tsx
// Renders a grid of products from context data
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';
import { renderProductCard } from './shared/product-card-html.ts';

export const productGridToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const source = (props.source as string) || 'all';
  const categoryId = props.categoryId as string || '';
  const limit = (props.limit as number) || 8;
  const columnsDesktop = (props.columnsDesktop as number) || (props.columns as number) || 4;
  const columnsMobile = (props.columnsMobile as number) || 2;
  const showPrice = (props.showPrice as boolean) ?? true;

  // Gather products from context based on source
  let products: Array<{ id: string; name: string; slug: string; price: number; compare_at_price?: number; free_shipping?: boolean; avg_rating?: number; review_count?: number; image_url?: string }> = [];

  if (source === 'category' && categoryId && context.categoryProducts) {
    products = context.categoryProducts.map(p => ({
      ...p,
      compare_at_price: p.compare_at_price ?? undefined,
      image_url: p.product_images?.find(i => i.is_primary)?.url || p.product_images?.[0]?.url,
    }));
  } else {
    // Use all products from context map
    for (const [id, p] of context.products) {
      const imgUrl = context.productImages.get(id) || '';
      products.push({ ...p, image_url: imgUrl });
    }
  }

  products = products.slice(0, limit);
  if (products.length === 0) return '';

  const cs = context.categorySettings || {};
  const cardsHtml = products.map(p => renderProductCard(p, context, cs, showPrice)).join('');

  return `<section class="sf-pg-section" style="max-width:1280px;margin:0 auto;padding:32px 16px;">
    ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;color:inherit;">${escapeHtml(title)}</h2>` : ''}
    <div class="sf-pg-grid" style="display:grid;grid-template-columns:repeat(${columnsDesktop},1fr);gap:16px;">
      ${cardsHtml}
    </div>
    <style>
      @media(max-width:768px){
        .sf-pg-section{padding:16px 8px !important;}
        .sf-pg-grid{grid-template-columns:repeat(${columnsMobile},1fr) !important;gap:8px !important;}
        .sf-pg-grid .sf-pc-card h3{font-size:12px !important;}
        .sf-pg-grid .sf-pc-card [style*="padding:8px 12px"]{padding:6px 8px 8px !important;}
        .sf-pg-grid .sf-pc-card .sf-btn-primary,.sf-pg-grid .sf-pc-card .sf-btn-secondary{min-height:36px !important;font-size:11px !important;}
      }
      @media(hover:hover){
        .sf-pc-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);}
        .sf-pc-card:hover img{transform:scale(1.05);}
      }
    </style>
  </section>`;
};
