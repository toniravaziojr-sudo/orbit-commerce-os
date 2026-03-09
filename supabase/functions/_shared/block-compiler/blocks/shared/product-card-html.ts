// =============================================
// SHARED PRODUCT CARD HTML RENDERER
// Reusable product card HTML for edge compilers
// Same visual output as featured-products.ts cards
// =============================================

import type { CompilerContext } from '../../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../../utils.ts';

interface ProductForCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  free_shipping?: boolean;
  avg_rating?: number;
  review_count?: number;
  image_url?: string;
}

export function renderProductCard(
  p: ProductForCard,
  context: CompilerContext,
  cs: Record<string, any>,
  showPrice = true,
): string {
  const imgUrl = optimizeImageUrl(p.image_url || context.productImages.get(p.id) || '', 400, 80);
  const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
  const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compare_at_price!) * 100) : 0;

  const showRatings = cs.showRatings ?? true;
  const showBadges = cs.showBadges ?? true;
  const showAddToCartButton = cs.showAddToCartButton ?? true;
  const quickBuyEnabled = cs.quickBuyEnabled ?? false;
  const buyNowButtonText = cs.buyNowButtonText || 'COMPRAR AGORA';

  // Badges
  let badgesHtml = '';
  if (showBadges) {
    const badges: string[] = [];
    const dynamicBadges = context.productBadges.get(p.id) || [];
    for (const db of dynamicBadges.slice(0, 3)) {
      const r = db.shape === 'circular' || db.shape === 'pill' ? '12px' : db.shape === 'square' ? '2px' : '4px';
      badges.push(`<span style="background:${db.background_color};color:${db.text_color};font-size:10px;font-weight:600;padding:3px 8px;border-radius:${r};white-space:nowrap;">${escapeHtml(db.name)}</span>`);
    }
    if (p.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">FRETE GRÁTIS</span>`);
    if (hasDiscount && discountPercent >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">-${discountPercent}%</span>`);
    if (badges.length > 0) {
      badgesHtml = `<div style="position:absolute;top:6px;left:6px;right:6px;display:flex;align-items:center;gap:4px;z-index:2;pointer-events:none;flex-wrap:nowrap;overflow:hidden;">${badges.slice(0, 3).join('')}</div>`;
    }
  }

  // Ratings
  let ratingsHtml = '';
  if (showRatings && p.avg_rating && p.avg_rating > 0) {
    const stars = '★'.repeat(Math.floor(p.avg_rating)) + (p.avg_rating % 1 >= 0.5 ? '☆' : '');
    ratingsHtml = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;"><span style="color:#f59e0b;font-size:12px;letter-spacing:1px;">${stars}</span>${p.review_count ? `<span style="font-size:11px;color:#666;">(${p.review_count})</span>` : ''}</div>`;
  }

  // Buttons
  let buttonsHtml = '';
  const btns: string[] = [];
  if (showAddToCartButton) {
    btns.push(`<button type="button" data-sf-action="add-to-cart" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(p.image_url || context.productImages.get(p.id) || '')}" class="sf-btn-outline-primary" style="width:100%;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Adicionar</button>`);
  }
  if (quickBuyEnabled) {
    btns.push(`<button type="button" data-sf-action="buy-now" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(p.image_url || context.productImages.get(p.id) || '')}" class="sf-btn-primary" style="display:block;width:100%;padding:8px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;text-align:center;min-height:36px;">${escapeHtml(buyNowButtonText)}</button>`);
  }
  if (btns.length > 0) {
    buttonsHtml = `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">${btns.join('')}</div>`;
  }

  return `<a href="/produto/${escapeHtml(p.slug)}" class="sf-pc-card" style="display:block;text-decoration:none;color:inherit;background:var(--theme-card-bg,#fff);border-radius:8px;overflow:hidden;border:1px solid var(--theme-card-border,#f0f0f0);transition:box-shadow 0.2s;position:relative;">
    ${badgesHtml}
    <div style="aspect-ratio:1;overflow:hidden;background:#f5f5f5;">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;transition:transform .3s;" loading="lazy">` : ''}
    </div>
    <div style="padding:8px 12px 12px;">
      ${ratingsHtml}
      <h3 style="font-size:13px;font-weight:500;margin-bottom:6px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:inherit;">${escapeHtml(p.name)}</h3>
      ${showPrice ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${hasDiscount ? `<span style="font-size:11px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(p.compare_at_price!)}</span>` : ''}<span style="font-size:14px;font-weight:700;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(p.price)}</span></div>` : ''}
      ${buttonsHtml}
    </div>
  </a>`;
}
