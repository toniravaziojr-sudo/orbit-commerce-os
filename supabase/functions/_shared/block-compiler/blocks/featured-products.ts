// =============================================
// FEATURED PRODUCTS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/FeaturedProductsBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Uses ProductCard shared component (badges, ratings, prices)
// - Grid layout with configurable columns (columnsDesktop, columnsMobile)
// - Responsive: columnsMobile cols on mobile (default 2)
// - Shows add-to-cart and buy-now buttons based on categorySettings
// - data-sf-action="add-to-cart" for hydration
// - Only shows REAL badges from context, no hardcoded fake data
// - Product link wraps entire card (no onclick blocking)
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

export function featuredProductsToStaticHTML(
  props: Record<string, unknown>,
  context: CompilerContext,
): string {
  const title = props.title as string || '';
  const productIds = Array.isArray(props.productIds) ? props.productIds as string[] : [];
  const columnsDesktop = (props.columnsDesktop as number) || (props.columns as number) || 4;
  const columnsMobile = (props.columnsMobile as number) || 2;
  const showPrice = (props.showPrice as boolean) ?? true;

  if (productIds.length === 0) return '';

  const validProducts = productIds
    .map(id => context.products.get(id))
    .filter(Boolean);

  if (validProducts.length === 0) return '';

  const cs = context.categorySettings || {};
  const showRatings = cs.showRatings ?? true;
  const showBadges = cs.showBadges ?? true;
  const showAddToCartButton = cs.showAddToCartButton ?? true;
  const quickBuyEnabled = cs.quickBuyEnabled ?? false;
  const buyNowButtonText = cs.buyNowButtonText || 'COMPRAR AGORA';

  const productCards = validProducts.map((product) => {
    const p = product!;
    const imgUrl = optimizeImageUrl(context.productImages.get(p.id) || '', 400, 80);
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compare_at_price!) * 100) : 0;

    // Badges — horizontal row matching ProductCardBadges (React uses flex row, not column)
    let badgesHtml = '';
    if (showBadges) {
      const badges: string[] = [];
      // Dynamic badges from "Aumentar Ticket" system
      const dynamicBadges = context.productBadges.get(p.id) || [];
      for (const db of dynamicBadges.slice(0, 3)) {
        const shapeRadius = db.shape === 'circular' || db.shape === 'pill' ? '12px' : db.shape === 'square' ? '2px' : '4px';
        badges.push(`<span style="background:${db.background_color};color:${db.text_color};font-size:10px;font-weight:600;padding:3px 8px;border-radius:${shapeRadius};max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(db.name)}</span>`);
      }
      // Static badges
      if (p.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;">FRETE GRÁTIS</span>`);
      if (hasDiscount && discountPercent >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;">-${discountPercent}%</span>`);
      if (badges.length > 0) {
        // Horizontal row at top-left (matches ProductCardBadges component)
        badgesHtml = `<div style="position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:4px;z-index:2;pointer-events:none;flex-wrap:nowrap;overflow:hidden;">${badges.slice(0, 3).join('')}</div>`;
      }
    }

    // Ratings — only show when real data exists
    let ratingsHtml = '';
    if (showRatings && p.avg_rating && p.avg_rating > 0) {
      const stars = '★'.repeat(Math.floor(p.avg_rating)) + (p.avg_rating % 1 >= 0.5 ? '☆' : '');
      ratingsHtml = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        <span style="color:#f59e0b;font-size:12px;letter-spacing:1px;">${stars}</span>
        ${p.review_count ? `<span style="font-size:11px;color:#666;">(${p.review_count})</span>` : ''}
      </div>`;
    }

    // Buttons container
    let buttonsHtml = '';
    const buttons: string[] = [];
    
    if (showAddToCartButton) {
      buttons.push(`<button data-sf-action="add-to-cart" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(context.productImages.get(p.id) || '')}" style="width:100%;padding:8px;background:transparent;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:13px;color:var(--theme-text-primary,#1a1a1a);display:flex;align-items:center;justify-content:center;gap:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/></svg>
        Adicionar
      </button>`);
    }
    
    if (quickBuyEnabled) {
      buttons.push(`<a href="/produto/${escapeHtml(p.slug)}" style="display:block;width:100%;padding:8px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;text-align:center;text-decoration:none;">${escapeHtml(buyNowButtonText)}</a>`);
    }
    
    if (buttons.length > 0) {
      buttonsHtml = `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">${buttons.join('')}</div>`;
    }

    return `<a href="/produto/${escapeHtml(p.slug)}" style="display:block;text-decoration:none;color:inherit;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;transition:box-shadow 0.2s;position:relative;">
      ${badgesHtml}
      <div style="aspect-ratio:1;overflow:hidden;background:#f5f5f5;">
        ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
      </div>
      <div style="padding:12px;">
        ${ratingsHtml}
        <h3 style="font-size:14px;font-weight:500;margin-bottom:8px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--theme-text-primary,#1a1a1a);">${escapeHtml(p.name)}</h3>
        ${showPrice ? `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:12px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(p.compare_at_price!)}</span>` : ''}
            <span style="font-size:16px;font-weight:700;color:var(--theme-text-primary,#1a1a1a);">${formatPriceFromDecimal(p.price)}</span>
          </div>
        ` : ''}
        ${buttonsHtml}
      </div>
    </a>`;
  }).join('');

  return `<section style="max-width:1280px;margin:0 auto;padding:32px 16px;">
    ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;font-family:var(--sf-heading-font);color:var(--theme-text-primary,#1a1a1a);">${escapeHtml(title)}</h2>` : ''}
    <div class="sf-fp-grid" style="display:grid;grid-template-columns:repeat(${columnsDesktop},1fr);gap:16px;">
      ${productCards}
    </div>
    <style>@media(max-width:768px){.sf-fp-grid{grid-template-columns:repeat(${columnsMobile},1fr) !important;}}</style>
  </section>`;
}
