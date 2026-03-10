// =============================================
// CATEGORY PAGE LAYOUT COMPILER — Block compiler for CategoryPageLayout
// Mirrors: src/components/builder/blocks/CategoryPageLayout.tsx
// Renders product grid with filters, sorting, pagination, ratings, badges, cart buttons
// v8.1.2: Added client-side filters, sorting, and load more
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

const PRODUCTS_PER_PAGE = 24;

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
  const totalProducts = products.length;
  const hasMoreThanOnePage = totalProducts > PRODUCTS_PER_PAGE;

  // Compute price range for filter
  const prices = products.map(p => p.price).filter(Boolean);
  const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
  const maxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 1000;
  const hasFreeShipping = products.some(p => p.free_shipping);
  const hasDiscounts = products.some(p => p.compare_at_price && p.compare_at_price > p.price);

  // === FILTER BAR + SORT ===
  // Desktop: horizontal row with all filters visible
  // Mobile (<640px): Collapsible button "Filtrar" that toggles filter panel (parity with Builder React CategoryFilters)
  const filterBarHtml = `
    <style>
      .sf-filter-bar { display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:10px;border:1px solid #eee; }
      .sf-filter-bar-filters { display:flex;align-items:center;gap:8px;flex:1;min-width:200px;flex-wrap:wrap; }
      .sf-filter-bar-sort { display:flex;align-items:center;gap:8px; }
      .sf-filter-label { display:flex;align-items:center;gap:4px;font-size:13px;color:#555;cursor:pointer;white-space:nowrap;padding:4px 10px;border:1px solid #ddd;border-radius:6px;background:#fff;user-select:none;transition:background .15s,border-color .15s; }
      .sf-filter-label:has(input:checked) { border-color:var(--theme-button-primary-bg,#1a1a1a);background:#f0f0f0; }
      .sf-filter-price-group { display:flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid #ddd;border-radius:6px;background:#fff; }
      .sf-filter-price-input { width:70px;padding:4px 6px;border:1px solid #eee;border-radius:4px;font-size:12px;outline:none; }
      /* Mobile: hide inline filters, show toggle button */
      .sf-filter-toggle-btn { display:none; }
      .sf-filter-mobile-panel { display:contents; }
      @media(max-width:639px) {
        .sf-filter-bar { padding:0;background:transparent;border:none;flex-direction:column;gap:8px; }
        .sf-filter-toggle-btn { display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 16px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:14px;font-weight:500;color:#333;cursor:pointer; }
        .sf-filter-mobile-panel { display:none;flex-direction:column;gap:8px;padding:12px;background:#f9fafb;border:1px solid #eee;border-radius:8px; }
        .sf-filter-mobile-panel.sf-filter-open { display:flex; }
        .sf-filter-bar-filters { flex-direction:column;align-items:stretch;gap:6px;min-width:0; }
        .sf-filter-bar-sort { width:100%; }
        .sf-filter-bar-sort select { flex:1; }
        .sf-filter-label { font-size:13px;padding:8px 12px; }
        .sf-filter-price-group { padding:8px 12px; }
        .sf-filter-price-input { width:auto;flex:1;padding:6px 8px;font-size:13px; }
        .sf-filter-bar .sf-filter-title { display:none; }
      }
    </style>
    <div class="sf-filter-bar" data-sf-cat-controls>
      <button type="button" class="sf-filter-toggle-btn" onclick="this.nextElementSibling.classList.toggle('sf-filter-open')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtrar
      </button>
      <div class="sf-filter-mobile-panel">
        <div class="sf-filter-bar-filters">
          <span class="sf-filter-title" style="font-size:13px;font-weight:600;color:#1a1a1a;white-space:nowrap;">Filtros:</span>
          ${hasFreeShipping ? `
          <label class="sf-filter-label" data-sf-filter-label="free-shipping">
            <input type="checkbox" data-sf-filter="free-shipping" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);cursor:pointer;">
            🚚 Frete grátis
          </label>` : ''}
          ${hasDiscounts ? `
          <label class="sf-filter-label" data-sf-filter-label="on-sale">
            <input type="checkbox" data-sf-filter="on-sale" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);cursor:pointer;">
            🏷️ Em promoção
          </label>` : ''}
          ${maxPrice - minPrice > 10 ? `
          <div class="sf-filter-price-group">
            <span style="font-size:12px;color:#666;white-space:nowrap;">Preço:</span>
            <input type="number" class="sf-filter-price-input" data-sf-filter="price-min" placeholder="Min" min="${minPrice}" max="${maxPrice}">
            <span style="font-size:12px;color:#999;">–</span>
            <input type="number" class="sf-filter-price-input" data-sf-filter="price-max" placeholder="Max" min="${minPrice}" max="${maxPrice}">
          </div>` : ''}
        </div>
        <div class="sf-filter-bar-sort">
          <label style="font-size:13px;color:#555;white-space:nowrap;">Ordenar:</label>
          <select data-sf-sort style="padding:6px 28px 6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:#fff;cursor:pointer;outline:none;color:#1a1a1a;appearance:auto;">
            <option value="default">Relevância</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="name-asc">A → Z</option>
            <option value="name-desc">Z → A</option>
            <option value="discount">Maior desconto</option>
          </select>
        </div>
      </div>
    </div>`;

  // Product count (will be updated by JS)
  const countHtml = `<p data-sf-cat-count style="font-size:14px;color:#666;margin-bottom:16px;">${totalProducts} produto${totalProducts !== 1 ? 's' : ''}</p>`;

  // Product cards — each card gets data attributes for client-side filtering
  const cardsHtml = products.map((p, index) => {
    const imgUrl = p.product_images?.[0]?.url;
    const optimized = optimizeImageUrl(imgUrl, 400, 80);
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compare_at_price!) * 100) : 0;

    // Badges — horizontal row matching ProductCardBadges (React uses flex row)
    let badgesHtml = '';
    if (showBadges) {
      const badges: string[] = [];
      // Dynamic badges from "Aumentar Ticket" system
      const dynamicBadges = context.productBadges.get(p.id) || [];
      for (const db of dynamicBadges.slice(0, 3)) {
        const shapeRadius = db.shape === 'circular' || db.shape === 'pill' ? '12px' : db.shape === 'square' ? '2px' : '4px';
        badges.push(`<span style="background:${db.background_color};color:${db.text_color};font-size:10px;font-weight:600;padding:3px 8px;border-radius:${shapeRadius};white-space:nowrap;">${escapeHtml(db.name)}</span>`);
      }
      // Static badges
      if (p.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">FRETE GRÁTIS</span>`);
      if (hasDiscount && discountPercent >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">-${discountPercent}%</span>`);
      if (badges.length > 0) {
        // Horizontal row at top-left (matches ProductCardBadges component)
        badgesHtml = `<div style="position:absolute;top:6px;left:6px;right:6px;display:flex;align-items:center;gap:4px;z-index:2;pointer-events:none;flex-wrap:nowrap;overflow:hidden;">${badges.slice(0, 3).join('')}</div>`;
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

    // Buttons (same order as builder: 1. Add to cart, 2. Custom, 3. Buy now / Quick buy)
    const buttonsHtml: string[] = [];
    if (showAddToCartButton) {
      buttonsHtml.push(`<button type="button" data-sf-action="add-to-cart" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(imgUrl || '')}" class="sf-btn-outline-primary" style="width:100%;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        Adicionar
      </button>`);
    }
    if (customButtonEnabled && customButtonText) {
      const customStyle = customButtonBgColor
        ? `background:${customButtonBgColor};color:${customButtonTextColor};border:none;`
        : `background:var(--theme-button-secondary-bg,#f5f5f5);color:var(--theme-button-secondary-text,#333);border:none;`;
      buttonsHtml.push(`<a href="${escapeHtml(customButtonLink || '#')}" style="display:block;width:100%;padding:8px;${customStyle}border-radius:6px;font-size:12px;text-align:center;text-decoration:none;">${escapeHtml(customButtonText)}</a>`);
    }
    if (quickBuyEnabled) {
      buttonsHtml.push(`<button type="button" data-sf-action="buy-now" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(imgUrl || '')}" class="sf-btn-primary" style="width:100%;padding:8px;border:none;border-radius:6px;font-size:12px;text-align:center;font-weight:500;cursor:pointer;min-height:36px;">${escapeHtml(buyNowButtonText)}</button>`);
    }

    // Hidden beyond first page initially
    const hiddenByPagination = hasMoreThanOnePage && index >= PRODUCTS_PER_PAGE;

    return `
      <div class="sf-cat-card" data-sf-product-card
        data-price="${p.price}"
        data-name="${escapeHtml(p.name)}"
        data-free-shipping="${p.free_shipping ? '1' : '0'}"
        data-has-discount="${hasDiscount ? '1' : '0'}"
        data-discount-pct="${discountPercent}"
        data-index="${index}"
        style="${hiddenByPagination ? 'display:none;' : ''}">
        <a href="/produto/${escapeHtml(p.slug)}" class="sf-cat-card-link" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;border:1px solid var(--theme-card-border,#f0f0f0);transition:box-shadow .2s;position:relative;height:100%;background:var(--theme-card-bg,#fff);">
          ${badgesHtml}
          <div style="aspect-ratio:1;background:#f9f9f9;overflow:hidden;">
            ${optimized ? `<img src="${escapeHtml(optimized)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;transition:transform .3s;" loading="lazy">` : ''}
          </div>
          <div style="padding:8px 12px 12px;flex:1;display:flex;flex-direction:column;">
            ${ratingsHtml}
            <p style="font-size:13px;font-weight:500;line-height:1.4;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.name)}</p>
            <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:auto;">
              ${hasDiscount ? `<span style="font-size:11px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(p.compare_at_price!)}</span>` : ''}
              <span style="font-size:14px;font-weight:700;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(p.price)}</span>
              ${hasDiscount ? `<span style="font-size:10px;font-weight:600;color:#16a34a;background:#dcfce7;padding:1px 6px;border-radius:3px;">-${discountPercent}%</span>` : ''}
            </div>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;" onclick="event.preventDefault();event.stopPropagation();">
              ${buttonsHtml.join('')}
            </div>
          </div>
        </a>
      </div>`;
  }).join('');

  // Load more button
  const loadMoreHtml = hasMoreThanOnePage ? `
    <div data-sf-load-more-wrap style="text-align:center;margin-top:32px;">
      <button data-sf-action="load-more" style="padding:12px 40px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
        Carregar mais produtos
      </button>
      <p data-sf-load-more-info style="font-size:12px;color:#999;margin-top:8px;">
        Exibindo ${Math.min(PRODUCTS_PER_PAGE, totalProducts)} de ${totalProducts} produtos
      </p>
    </div>` : '';

  // No results placeholder (hidden by default, shown by JS)
  const noResultsHtml = `
    <div data-sf-no-results style="display:none;text-align:center;padding:48px 16px;color:#999;">
      <p style="font-size:16px;font-weight:500;margin-bottom:8px;">Nenhum produto encontrado</p>
      <p style="font-size:13px;">Tente ajustar os filtros para ver mais resultados.</p>
      <button data-sf-action="clear-filters" style="margin-top:16px;padding:8px 24px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:6px;font-size:13px;cursor:pointer;">Limpar filtros</button>
    </div>`;

  // JSON-LD
  const jsonLd = category ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": category.name,
    "description": category.description || '',
    "url": `https://${context.hostname}/categoria/${category.slug}`,
    "numberOfItems": totalProducts,
  }) : '';

  return `
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;" data-sf-cat-container data-page-size="${PRODUCTS_PER_PAGE}" data-total="${totalProducts}">
      ${filterBarHtml}
      ${countHtml}
      <style>
        .sf-cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media(max-width:639px) { .sf-cat-grid { gap: 8px !important; } }
        @media(min-width:640px) { .sf-cat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media(min-width:1024px) { .sf-cat-grid { grid-template-columns: repeat(${columns}, 1fr); } }
        .sf-cat-card { transition: opacity .2s; }
        @media(hover:hover){
          .sf-cat-card-link:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          .sf-cat-card-link:hover img { transform: scale(1.05); }
        }
        @media(max-width:639px) {
          .sf-cat-card .sf-btn-primary,.sf-cat-card .sf-btn-outline-primary{min-height:36px !important;font-size:11px !important;}
          .sf-cat-card [style*="padding:8px 12px"]{padding:6px 8px 8px !important;}
        }
      </style>
      <div class="sf-cat-grid" data-sf-cat-grid>${cardsHtml}</div>
      ${noResultsHtml}
      ${loadMoreHtml}
    </div>`;
};
