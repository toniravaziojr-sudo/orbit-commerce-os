// =============================================
// CATEGORY PAGE LAYOUT COMPILER — Block compiler for CategoryPageLayout
// Mirrors: src/components/builder/blocks/CategoryPageLayout.tsx
// Renders product grid with filters, ratings, badges, cart buttons
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

export const categoryPageLayoutToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const products = context.categoryProducts || [];
  const category = context.currentCategory;
  const cs = context.categorySettings || {};

  const showRatings = cs.showRatings ?? true;
  const showBadges = cs.showBadges ?? true;
  const showAddToCartButton = cs.showAddToCartButton ?? true;
  const quickBuyEnabled = cs.quickBuyEnabled ?? false;
  const buyNowButtonText = cs.buyNowButtonText || 'Comprar agora';
  const customButtonEnabled = cs.customButtonEnabled ?? false;
  const customButtonText = cs.customButtonText || '';
  const customButtonBgColor = cs.customButtonBgColor || cs.customButtonColor || '';
  const customButtonTextColor = cs.customButtonTextColor || '#ffffff';
  const customButtonLink = cs.customButtonLink || '';

  const columns = (props.columns as number) || 4;

  // Product count
  const countHtml = `<p style="font-size:14px;color:var(--theme-text-secondary,#666);margin-bottom:24px;">${products.length} produto${products.length !== 1 ? 's' : ''}</p>`;

  // Product cards
  const cardsHtml = products.map((p) => {
    const imgUrl = p.product_images?.[0]?.url;
    const optimized = optimizeImageUrl(imgUrl, 400, 80);
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compare_at_price!) * 100) : 0;

    // Badges
    let badgesHtml = '';
    if (showBadges) {
      const badges: string[] = [];
      if (p.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">FRETE GRÁTIS</span>`);
      if (hasDiscount && discountPercent >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">-${discountPercent}%</span>`);
      if (badges.length > 0) {
        badgesHtml = `<div style="position:absolute;top:8px;left:8px;display:flex;flex-direction:column;gap:4px;z-index:2;">${badges.join('')}</div>`;
      }
    }

    // Ratings
    let ratingsHtml = '';
    if (showRatings && p.avg_rating && p.review_count) {
      const fullStars = Math.floor(p.avg_rating);
      const halfStar = p.avg_rating % 1 >= 0.5;
      const stars = '★'.repeat(fullStars) + (halfStar ? '☆' : '');
      ratingsHtml = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        <span style="color:#f59e0b;font-size:12px;letter-spacing:1px;">${stars}</span>
        <span style="font-size:11px;color:#666;">(${p.review_count})</span>
      </div>`;
    }

    // Buttons (same order as builder: 1. Add to cart, 2. Custom, 3. Buy now)
    const buttonsHtml: string[] = [];

    // 1. Add to cart button
    if (showAddToCartButton) {
      buttonsHtml.push(`<button data-sf-action="add-to-cart" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(imgUrl || '')}" style="width:100%;padding:8px;background:transparent;border:1px solid var(--theme-button-primary-bg,#1a1a1a);border-radius:6px;cursor:pointer;font-size:12px;color:var(--theme-button-primary-bg,#1a1a1a);display:flex;align-items:center;justify-content:center;gap:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        Adicionar
      </button>`);
    }

    // 2. Custom button
    if (customButtonEnabled && customButtonText) {
      const customStyle = customButtonBgColor
        ? `background:${customButtonBgColor};color:${customButtonTextColor};border:none;`
        : `background:var(--theme-button-secondary-bg,#f5f5f5);color:var(--theme-button-secondary-text,#333);border:none;`;
      buttonsHtml.push(`<a href="${escapeHtml(customButtonLink || '#')}" style="display:block;width:100%;padding:8px;${customStyle}border-radius:6px;font-size:12px;text-align:center;text-decoration:none;">${escapeHtml(customButtonText)}</a>`);
    }

    // 3. Buy now / primary CTA
    buttonsHtml.push(`<a href="/produto/${escapeHtml(p.slug)}" style="display:block;width:100%;padding:8px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border-radius:6px;font-size:12px;text-align:center;text-decoration:none;font-weight:500;">${escapeHtml(buyNowButtonText)}</a>`);

    return `
      <a href="/produto/${escapeHtml(p.slug)}" style="display:block;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;transition:box-shadow .2s;position:relative;">
        ${badgesHtml}
        <div style="aspect-ratio:1;background:#f9f9f9;overflow:hidden;">
          ${optimized ? `<img src="${escapeHtml(optimized)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
        </div>
        <div style="padding:12px;" onclick="event.preventDefault();event.stopPropagation();">
          ${ratingsHtml}
          <p style="font-size:14px;font-weight:500;line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.name)}</p>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:12px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(p.compare_at_price!)}</span>` : ''}
            <span style="font-size:16px;font-weight:700;color:var(--theme-price-color, var(--theme-text-primary,#1a1a1a));">${formatPriceFromDecimal(p.price)}</span>
            ${hasDiscount ? `<span style="font-size:11px;font-weight:600;color:#16a34a;background:#dcfce7;padding:1px 6px;border-radius:3px;">-${discountPercent}%</span>` : ''}
          </div>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
            ${buttonsHtml.join('')}
          </div>
        </div>
      </a>`;
  }).join('');

  // JSON-LD
  const jsonLd = category ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": category.name,
    "description": category.description || '',
    "url": `https://${context.hostname}/categoria/${category.slug}`,
    "numberOfItems": products.length,
  }) : '';

  return `
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      ${countHtml}
      <style>
        .sf-cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media(min-width:640px) { .sf-cat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media(min-width:1024px) { .sf-cat-grid { grid-template-columns: repeat(${columns}, 1fr); } }
      </style>
      <div class="sf-cat-grid">${cardsHtml}</div>
    </div>`;
};
