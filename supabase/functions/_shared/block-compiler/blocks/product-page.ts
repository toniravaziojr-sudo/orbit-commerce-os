// =============================================
// PRODUCT PAGE COMPILER — Renders product page HTML
// Mirrors: src/pages/storefront/StorefrontProduct.tsx
// =============================================

import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

interface ProductPageData {
  product: {
    id: string;
    name: string;
    slug: string;
    sku?: string;
    price: number;
    compare_at_price?: number;
    description?: string;
    short_description?: string;
    brand?: string;
    stock_quantity?: number;
    status?: string;
    free_shipping?: boolean;
    has_variants?: boolean;
    tags?: string[];
  };
  images: Array<{
    id?: string;
    url: string;
    alt_text?: string;
    is_primary?: boolean;
    sort_order?: number;
  }>;
  hostname: string;
  storeSettings?: any;
  productSettings?: any;
}

export function productPageToStaticHTML(data: ProductPageData): string {
  const { product, images, hostname, storeSettings, productSettings } = data;
  
  const showGallery = productSettings?.showGallery ?? true;
  const showDescription = productSettings?.showDescription ?? true;
  const showRelatedProducts = productSettings?.showRelatedProducts ?? true;
  const relatedProductsTitle = productSettings?.relatedProductsTitle || 'Produtos Relacionados';
  
  const mainImage = images.find(i => i.is_primary) || images[0];
  const otherImages = images.filter(i => i !== mainImage).slice(0, 4);
  
  const optimizedMain = mainImage ? optimizeImageUrl(mainImage.url, 800, 85) : '';
  const preloadTag = optimizedMain ? `<link rel="preload" as="image" href="${escapeHtml(optimizedMain)}" fetchpriority="high">` : '';
  
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  // Thumbnails
  const thumbsHtml = otherImages.map(img => {
    const thumb = optimizeImageUrl(img.url, 120, 75);
    return `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(img.alt_text || product.name)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #eee;cursor:pointer;" loading="lazy">`;
  }).join('');

  // JSON-LD
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.short_description || product.description || '',
    "image": images.map(i => i.url).filter(Boolean),
    "sku": product.sku || '',
    "brand": product.brand ? { "@type": "Brand", "name": product.brand } : undefined,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "BRL",
      "price": product.price.toFixed(2),
      "availability": (product.stock_quantity ?? 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "url": `https://${hostname}/produto/${product.slug}`,
    }
  });

  // Installments
  const installmentValue = formatPriceFromDecimal(product.price / 12);

  return `
    ${preloadTag}
    <script type="application/ld+json">${jsonLd}</script>
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      <style>
        @media(min-width:768px) { .sf-pdp-grid { grid-template-columns: 1fr 1fr !important; } }
      </style>
      <div class="sf-pdp-grid" style="display:grid;grid-template-columns:1fr;gap:32px;">
        <!-- Gallery -->
        <div>
          ${optimizedMain ? `<img src="${escapeHtml(optimizedMain)}" alt="${escapeHtml(product.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:8px;background:#f9f9f9;" loading="eager" fetchpriority="high">` : ''}
          ${thumbsHtml ? `<div style="display:flex;gap:8px;margin-top:12px;overflow-x:auto;">${thumbsHtml}</div>` : ''}
        </div>
        <!-- Info -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <h1 style="font-size:clamp(20px,3vw,32px);font-weight:700;font-family:var(--sf-heading-font);line-height:1.3;">${escapeHtml(product.name)}</h1>
          ${product.brand ? `<p style="font-size:14px;color:var(--theme-text-secondary,#666);">${escapeHtml(product.brand)}</p>` : ''}
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:14px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(product.compare_at_price!)}</span>` : ''}
            <span style="font-size:28px;font-weight:700;color:var(--theme-text-primary,#1a1a1a);">${formatPriceFromDecimal(product.price)}</span>
            ${hasDiscount ? `<span style="font-size:13px;font-weight:600;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:4px;">-${discountPercent}%</span>` : ''}
          </div>
          <p style="font-size:13px;color:#666;">em até 12x de ${installmentValue} sem juros</p>
          ${product.short_description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#555);line-height:1.6;">${escapeHtml(product.short_description)}</p>` : ''}
          ${(product.stock_quantity ?? 0) > 0
            ? `<button data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${escapeHtml(optimizeImageUrl(mainImage?.url, 120, 75))}" class="sf-btn-primary" style="margin-top:8px;padding:14px 32px;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%;max-width:400px;">Adicionar ao carrinho</button>`
            : `<p style="margin-top:8px;padding:14px;background:#fef2f2;color:#dc2626;border-radius:8px;text-align:center;font-weight:500;">Produto indisponível</p>`
          }
          ${product.free_shipping ? `<p style="font-size:13px;color:#16a34a;font-weight:500;margin-top:4px;">🚚 Frete grátis</p>` : ''}
        </div>
      </div>
      ${showDescription && product.description ? `
        <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;">
          <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);margin-bottom:16px;">Descrição</h2>
          <div style="font-size:15px;line-height:1.8;color:var(--theme-text-secondary,#444);">${product.description}</div>
        </div>
      ` : ''}
    </div>`;
}
