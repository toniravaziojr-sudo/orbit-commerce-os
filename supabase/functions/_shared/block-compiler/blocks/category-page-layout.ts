// =============================================
// CATEGORY PAGE LAYOUT COMPILER — Block compiler for CategoryPageLayout
// Mirrors: src/components/builder/blocks/CategoryPageLayout.tsx
// Renders product grid with sidebar filters (desktop) and Sheet-style filters (mobile)
// v8.5.0: Sidebar filters layout matching React CategoryFilters component (parity)
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

  const fmtPrice = (v: number) => `R$ ${v}`;

  // === SIDEBAR FILTERS (Desktop) — Matches React CategoryFilters sidebar ===
  const sidebarHtml = `
    <aside class="sf-filter-sidebar">
      <div class="sf-filter-sidebar-inner">
        <h3 class="sf-filter-sidebar-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filtros
        </h3>

        <!-- Ordenar por -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:500;margin-bottom:8px;color:inherit;">Ordenar por</label>
          <select data-sf-sort style="width:100%;padding:8px 12px;border:1px solid var(--theme-card-border,#e5e7eb);border-radius:6px;font-size:13px;background:var(--theme-card-bg,#fff);color:inherit;outline:none;cursor:pointer;">
            <option value="default">Relevância</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="name-asc">A → Z</option>
            <option value="name-desc">Z → A</option>
            <option value="discount">Maior desconto</option>
          </select>
        </div>

        <!-- Faixa de preço — collapsible -->
        <div class="sf-filter-section" data-sf-section-open="true">
          <button type="button" class="sf-filter-section-trigger" onclick="this.parentElement.dataset.sfSectionOpen=this.parentElement.dataset.sfSectionOpen==='true'?'false':'true'">
            Faixa de preço
            <svg class="sf-filter-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="sf-filter-section-content">
            <div style="padding:8px 0;">
              <input type="range" data-sf-filter="price-range" min="${minPrice}" max="${maxPrice}" value="${maxPrice}" style="width:100%;accent-color:var(--theme-button-primary-bg,#1a1a1a);cursor:pointer;">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-top:4px;">
                <span>${fmtPrice(minPrice)}</span>
                <span>${fmtPrice(maxPrice)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Disponibilidade — collapsible -->
        <div class="sf-filter-section" data-sf-section-open="true">
          <button type="button" class="sf-filter-section-trigger" onclick="this.parentElement.dataset.sfSectionOpen=this.parentElement.dataset.sfSectionOpen==='true'?'false':'true'">
            Disponibilidade
            <svg class="sf-filter-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="sf-filter-section-content">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 0;">
              <input type="checkbox" data-sf-filter="in-stock" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);width:16px;height:16px;cursor:pointer;">
              <span style="font-size:13px;color:inherit;">Apenas em estoque</span>
            </label>
          </div>
        </div>

        ${hasFreeShipping ? `
        <div style="padding:8px 0;border-top:1px solid var(--theme-card-border,#e5e7eb);">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" data-sf-filter="free-shipping" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);width:16px;height:16px;cursor:pointer;">
            <span style="font-size:13px;color:inherit;display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg> Frete grátis</span>
          </label>
        </div>` : ''}

        ${hasDiscounts ? `
        <div style="padding:8px 0;border-top:1px solid var(--theme-card-border,#e5e7eb);">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" data-sf-filter="on-sale" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);width:16px;height:16px;cursor:pointer;">
            <span style="font-size:13px;color:inherit;display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg> Em promoção</span>
          </label>
        </div>` : ''}
      </div>
    </aside>`;

  // === MOBILE FILTER BUTTON — Matches React CategoryFilters Sheet trigger ===
  const mobileFilterHtml = `
    <div class="sf-filter-mobile-trigger">
      <button type="button" class="sf-filter-mobile-btn" onclick="document.getElementById('sf-filter-sheet').classList.add('sf-sheet-open')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtrar
      </button>
    </div>
    <div id="sf-filter-sheet" class="sf-filter-sheet-overlay" onclick="if(event.target===this)this.classList.remove('sf-sheet-open')">
      <div class="sf-filter-sheet-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #eee;">
          <h3 style="font-size:16px;font-weight:600;margin:0;">Filtros</h3>
          <button type="button" onclick="document.getElementById('sf-filter-sheet').classList.remove('sf-sheet-open')" style="border:none;background:none;cursor:pointer;padding:4px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div style="padding:16px;overflow-y:auto;max-height:calc(80vh - 60px);">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:500;margin-bottom:8px;">Ordenar por</label>
            <select data-sf-sort-mobile style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff;outline:none;">
              <option value="default">Relevância</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
              <option value="name-asc">A → Z</option>
              <option value="name-desc">Z → A</option>
              <option value="discount">Maior desconto</option>
            </select>
          </div>
          <div style="margin-bottom:16px;">
            <p style="font-size:13px;font-weight:500;margin-bottom:8px;">Faixa de preço</p>
            <input type="range" data-sf-filter="price-range-mobile" min="${minPrice}" max="${maxPrice}" value="${maxPrice}" style="width:100%;accent-color:var(--theme-button-primary-bg,#1a1a1a);">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-top:4px;">
              <span>${fmtPrice(minPrice)}</span>
              <span>${fmtPrice(maxPrice)}</span>
            </div>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" data-sf-filter="in-stock-mobile" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);width:18px;height:18px;">
              <span style="font-size:14px;">Apenas em estoque</span>
            </label>
          </div>
          ${hasFreeShipping ? `
          <div style="margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" data-sf-filter="free-shipping-mobile" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);width:18px;height:18px;">
              <span style="font-size:14px;display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg> Frete grátis</span>
            </label>
          </div>` : ''}
          ${hasDiscounts ? `
          <div style="margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" data-sf-filter="on-sale-mobile" style="accent-color:var(--theme-button-primary-bg,#1a1a1a);width:18px;height:18px;">
              <span style="font-size:14px;display:inline-flex;align-items:center;gap:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg> Em promoção</span>
            </label>
          </div>` : ''}
        </div>
      </div>
    </div>`;

  // Product count
  const countHtml = `<p data-sf-cat-count style="font-size:14px;color:#666;margin-bottom:16px;">${totalProducts} produto${totalProducts !== 1 ? 's' : ''}</p>`;

  // Product cards
  const cardsHtml = products.map((p, index) => {
    const imgUrl = p.product_images?.[0]?.url;
    const optimized = optimizeImageUrl(imgUrl, 400, 80);
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compare_at_price!) * 100) : 0;

    let badgesHtml = '';
    if (showBadges) {
      const badges: string[] = [];
      const dynamicBadges = context.productBadges.get(p.id) || [];
      for (const db of dynamicBadges.slice(0, 3)) {
        const shapeRadius = db.shape === 'circular' || db.shape === 'pill' ? '12px' : db.shape === 'square' ? '2px' : '4px';
        badges.push(`<span style="background:${db.background_color};color:${db.text_color};font-size:10px;font-weight:600;padding:3px 8px;border-radius:${shapeRadius};white-space:nowrap;">${escapeHtml(db.name)}</span>`);
      }
      if (p.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">FRETE GRÁTIS</span>`);
      if (hasDiscount && discountPercent >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">-${discountPercent}%</span>`);
      if (badges.length > 0) {
        badgesHtml = `<div style="position:absolute;top:6px;left:6px;right:6px;display:flex;align-items:center;gap:4px;z-index:2;pointer-events:none;flex-wrap:nowrap;overflow:hidden;">${badges.slice(0, 3).join('')}</div>`;
      }
    }

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

    const buttonsHtml: string[] = [];
    if (showAddToCartButton) {
      buttonsHtml.push(`<button type="button" data-sf-action="add-to-cart" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(imgUrl || '')}" class="sf-btn-secondary" style="width:100%;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border:1px solid #ddd;">
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

  const loadMoreHtml = hasMoreThanOnePage ? `
    <div data-sf-load-more-wrap style="text-align:center;margin-top:32px;">
      <button data-sf-action="load-more" style="padding:12px 40px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
        Carregar mais produtos
      </button>
      <p data-sf-load-more-info style="font-size:12px;color:#999;margin-top:8px;">
        Exibindo ${Math.min(PRODUCTS_PER_PAGE, totalProducts)} de ${totalProducts} produtos
      </p>
    </div>` : '';

  const noResultsHtml = `
    <div data-sf-no-results style="display:none;text-align:center;padding:48px 16px;color:#999;">
      <p style="font-size:16px;font-weight:500;margin-bottom:8px;">Nenhum produto encontrado</p>
      <p style="font-size:13px;">Tente ajustar os filtros para ver mais resultados.</p>
      <button data-sf-action="clear-filters" style="margin-top:16px;padding:8px 24px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:6px;font-size:13px;cursor:pointer;">Limpar filtros</button>
    </div>`;

  const jsonLd = category ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": category.name,
    "description": category.description || '',
    "url": `https://${context.hostname}/categoria/${category.slug}`,
    "numberOfItems": totalProducts,
  }) : '';

  // === STYLES — Parity with React CategoryFilters + CategoryPageLayout ===
  const styles = `<style>
    /* Sidebar — Desktop only (matches React: hidden lg:block, w-64) */
    .sf-filter-sidebar { display:none; }
    @media(min-width:1024px) {
      .sf-filter-sidebar { display:block;width:256px;flex-shrink:0; }
      .sf-filter-sidebar-inner {
        position:sticky;top:96px;
        background:var(--theme-card-bg,#fff);
        border-radius:8px;border:1px solid var(--theme-card-border,#e5e7eb);
        padding:16px;
      }
    }
    .sf-filter-sidebar-title {
      display:flex;align-items:center;gap:8px;
      font-size:15px;font-weight:600;margin-bottom:16px;color:inherit;
    }
    .sf-filter-section { border-top:1px solid var(--theme-card-border,#e5e7eb);padding-top:8px;margin-top:8px; }
    .sf-filter-section-trigger {
      display:flex;align-items:center;justify-content:space-between;width:100%;
      padding:8px 0;font-size:13px;font-weight:500;color:inherit;
      background:none;border:none;cursor:pointer;text-align:left;
    }
    .sf-filter-section-trigger:hover { color:var(--theme-button-primary-bg,#1a1a1a); }
    .sf-filter-chevron { transition:transform .2s; }
    .sf-filter-section[data-sf-section-open="false"] .sf-filter-section-content { display:none; }
    .sf-filter-section[data-sf-section-open="false"] .sf-filter-chevron { transform:rotate(-90deg); }

    /* Mobile trigger — visible only <1024px (matches React: lg:hidden) */
    .sf-filter-mobile-trigger { display:block;margin-bottom:16px; }
    @media(min-width:1024px) { .sf-filter-mobile-trigger { display:none; } }
    .sf-filter-mobile-btn {
      display:flex;align-items:center;justify-content:center;gap:8px;
      width:100%;padding:10px 16px;
      border:1px solid var(--theme-card-border,#ddd);border-radius:8px;
      background:var(--theme-card-bg,#fff);font-size:14px;font-weight:500;
      color:inherit;cursor:pointer;
    }

    /* Sheet overlay (matches React Sheet component behavior) */
    .sf-filter-sheet-overlay {
      display:none;position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,0.5);
    }
    .sf-filter-sheet-overlay.sf-sheet-open { display:flex;align-items:flex-end; }
    .sf-filter-sheet-panel {
      width:100%;max-height:80vh;
      background:var(--theme-card-bg,#fff);
      border-radius:16px 16px 0 0;
      overflow:hidden;
    }

    /* Layout: sidebar + grid (flex row) */
    .sf-cat-layout { display:flex;gap:24px; }

    /* Product grid */
    .sf-cat-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:16px; }
    @media(max-width:639px) { .sf-cat-grid { gap:8px !important; } }
    @media(min-width:640px) { .sf-cat-grid { grid-template-columns:repeat(3,1fr); } }
    @media(min-width:1024px) { .sf-cat-grid { grid-template-columns:repeat(${columns},1fr); } }

    .sf-cat-card { transition:opacity .2s; }
    @media(hover:hover){
      .sf-cat-card-link:hover { box-shadow:0 4px 12px rgba(0,0,0,0.08); }
      .sf-cat-card-link:hover img { transform:scale(1.05); }
    }
    @media(max-width:639px) {
      .sf-cat-card .sf-btn-primary,.sf-cat-card .sf-btn-secondary{min-height:36px !important;font-size:11px !important;}
      .sf-cat-card [style*="padding:8px 12px"]{padding:6px 8px 8px !important;}
    }
  </style>`;

  return `
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
    ${styles}
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;" data-sf-cat-container data-page-size="${PRODUCTS_PER_PAGE}" data-total="${totalProducts}">
      ${mobileFilterHtml}
      <div class="sf-cat-layout">
        ${sidebarHtml}
        <div style="flex:1;min-width:0;">
          ${countHtml}
          <div class="sf-cat-grid" data-sf-cat-grid>${cardsHtml}</div>
          ${noResultsHtml}
          ${loadMoreHtml}
        </div>
      </div>
    </div>`;
};
