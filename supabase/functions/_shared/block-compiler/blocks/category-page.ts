// =============================================
// CATEGORY PAGE COMPILER — Renders category page HTML
// Mirrors: src/pages/storefront/StorefrontCategory.tsx
// =============================================

import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

interface CategoryPageData {
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    banner_desktop_url?: string;
    banner_mobile_url?: string;
  };
  products: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price?: number;
    stock_quantity?: number;
    status?: string;
    free_shipping?: boolean;
    avg_rating?: number;
    review_count?: number;
    product_images?: Array<{ url: string; is_primary?: boolean; sort_order?: number }>;
  }>;
  hostname: string;
  categorySettings?: any;
}

export function categoryPageToStaticHTML(data: CategoryPageData): string {
  const { category, products, hostname, categorySettings } = data;
  
  const showRatings = categorySettings?.showRatings ?? true;
  const showBadges = categorySettings?.showBadges ?? true;
  const showAddToCartButton = categorySettings?.showAddToCartButton ?? true;
  
  // Category banner
  const bannerUrl = category.banner_desktop_url;
  const bannerMobileUrl = category.banner_mobile_url;
  
  let categoryBanner: string;
  if (bannerUrl) {
    const desktopSrc = optimizeImageUrl(bannerUrl, 1920, 80);
    const mobileSrc = bannerMobileUrl ? optimizeImageUrl(bannerMobileUrl, 768, 80) : desktopSrc;
    
    categoryBanner = `
      <div style="position:relative;width:100%;height:200px;overflow:hidden;background:#f5f5f5;">
        <picture>
          ${mobileSrc !== desktopSrc ? `<source srcset="${escapeHtml(mobileSrc)}" media="(max-width:768px)">` : ''}
          <img src="${escapeHtml(desktopSrc)}" alt="${escapeHtml(category.name)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="eager" fetchpriority="high">
        </picture>
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <h1 style="font-size:clamp(24px,4vw,40px);font-weight:700;color:#fff;font-family:var(--sf-heading-font);">${escapeHtml(category.name)}</h1>
        </div>
      </div>`;
  } else {
    categoryBanner = `
      <div style="padding:32px 16px;text-align:center;">
        <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);">${escapeHtml(category.name)}</h1>
        ${category.description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#666);margin-top:8px;max-width:600px;margin-left:auto;margin-right:auto;">${escapeHtml(category.description)}</p>` : ''}
      </div>`;
  }

  // Product cards
  const productsGrid = products.map((p, index) => {
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
      const stars = '★'.repeat(Math.floor(p.avg_rating)) + (p.avg_rating % 1 >= 0.5 ? '☆' : '');
      ratingsHtml = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        <span style="color:#f59e0b;font-size:12px;letter-spacing:1px;">${stars}</span>
        <span style="font-size:11px;color:#666;">(${p.review_count})</span>
      </div>`;
    }

    // Add to cart
    let addToCartHtml = '';
    if (showAddToCartButton) {
      addToCartHtml = `<button data-sf-action="add-to-cart" data-product-id="${p.id}" data-product-name="${escapeHtml(p.name)}" data-product-price="${p.price}" data-product-image="${escapeHtml(imgUrl || '')}" style="width:100%;padding:8px;background:transparent;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:13px;color:var(--theme-text-primary,#1a1a1a);display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/></svg>
        Adicionar
      </button>`;
    }

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
            <span style="font-size:16px;font-weight:700;">${formatPriceFromDecimal(p.price)}</span>
            ${hasDiscount ? `<span style="font-size:11px;font-weight:600;color:#16a34a;background:#dcfce7;padding:1px 6px;border-radius:3px;">-${discountPercent}%</span>` : ''}
          </div>
          ${addToCartHtml}
        </div>
      </a>`;
  }).join('');

  // JSON-LD
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": category.name,
    "description": category.description || '',
    "url": `https://${hostname}/categoria/${category.slug}`,
    "numberOfItems": products.length,
  });

  return `
    <script type="application/ld+json">${jsonLd}</script>
    ${categoryBanner}
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      <p style="font-size:14px;color:var(--theme-text-secondary,#666);margin-bottom:24px;">${products.length} produto${products.length !== 1 ? 's' : ''}</p>
      <style>
        .sf-cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media(min-width:640px) { .sf-cat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media(min-width:1024px) { .sf-cat-grid { grid-template-columns: repeat(4, 1fr); } }
      </style>
      <div class="sf-cat-grid">${productsGrid}</div>
    </div>`;
}
