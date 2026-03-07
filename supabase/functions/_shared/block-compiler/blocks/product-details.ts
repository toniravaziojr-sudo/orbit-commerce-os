// =============================================
// PRODUCT DETAILS COMPILER — Block compiler for ProductDetails
// Mirrors: src/components/builder/BlockRenderer.tsx ProductDetailsBlock
// Renders breadcrumb, gallery, rating, info, price, quantity, CTA, shipping, description
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

function renderStars(avg: number): string {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const fill = avg >= i ? '#facc15' : (avg >= i - 0.5 ? '#facc15' : '#d1d5db');
    html += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${fill}" stroke="${fill}" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
  return html;
}

export const productDetailsToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const product = context.currentProduct;
  const images = context.currentProductImages || [];
  if (!product) return '';

  const ps = context.productSettings || {};

  const showGallery = ps.showGallery ?? true;
  const showDescription = ps.showDescription ?? true;
  const showStock = ps.showStock ?? true;
  const showReviews = ps.showReviews ?? true;
  const showBuyTogether = ps.showBuyTogether ?? true;
  const showRelatedProducts = ps.showRelatedProducts ?? true;
  const relatedProductsTitle = ps.relatedProductsTitle || 'Produtos Relacionados';
  const showWhatsAppButton = ps.showWhatsAppButton ?? true;
  const showAddToCartButton = ps.showAddToCartButton ?? true;
  const showBadges = ps.showBadges ?? true;
  const showShippingCalculator = ps.showShippingCalculator ?? true;
  const buyNowButtonText = ps.buyNowButtonText || 'Comprar agora';
  const showBuyNowButton = ps.showBuyNowButton ?? true;
  const showAdditionalHighlight = ps.showAdditionalHighlight ?? false;
  const additionalHighlightImagesDesktop = ps.additionalHighlightImagesDesktop || ps.additionalHighlightImages || [];
  const additionalHighlightImagesMobile = ps.additionalHighlightImagesMobile || [];

  const mainImage = images.find(i => i.is_primary) || images[0];
  const otherImages = images.filter(i => i !== mainImage).slice(0, 5);
  
  const optimizedMain = mainImage ? optimizeImageUrl(mainImage.url, 800, 85) : '';

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  // === BREADCRUMB ===
  const category = context.currentProductCategory;
  let breadcrumbHtml = '';
  {
    const crumbs: string[] = [];
    crumbs.push(`<a href="/" style="color:var(--theme-text-secondary,#666);text-decoration:none;font-size:13px;">Início</a>`);
    if (category) {
      crumbs.push(`<span style="color:#999;font-size:12px;">›</span>`);
      crumbs.push(`<a href="/categoria/${escapeHtml(category.slug)}" style="color:var(--theme-text-secondary,#666);text-decoration:none;font-size:13px;">${escapeHtml(category.name)}</a>`);
    }
    crumbs.push(`<span style="color:#999;font-size:12px;">›</span>`);
    crumbs.push(`<span style="color:var(--theme-text-primary,#1a1a1a);font-size:13px;font-weight:500;">${escapeHtml(product.name)}</span>`);
    breadcrumbHtml = `<nav aria-label="breadcrumb" style="margin-bottom:16px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${crumbs.join('')}</nav>`;
  }

  // === RATING SUMMARY ===
  let ratingHtml = '';
  if (product.avg_rating && product.review_count && product.review_count > 0) {
    ratingHtml = `<div style="display:flex;align-items:center;gap:6px;margin-top:-8px;">
      <div style="display:flex;align-items:center;gap:1px;">${renderStars(product.avg_rating)}</div>
      <span style="font-size:14px;font-weight:600;color:var(--theme-text-primary,#1a1a1a);">${product.avg_rating.toFixed(1)}</span>
      <span style="font-size:13px;color:var(--theme-text-secondary,#666);">(${product.review_count} avaliação${product.review_count > 1 ? 'ões' : ''})</span>
    </div>`;
  }

  // Thumbnails
  const thumbsHtml = otherImages.map(img => {
    const thumb = optimizeImageUrl(img.url, 120, 75);
    return `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(img.alt_text || product.name)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #eee;cursor:pointer;" loading="lazy">`;
  }).join('');

  // Installments
  const installmentValue = formatPriceFromDecimal(product.price / 12);

  // Stock info
  let stockHtml = '';
  if (showStock) {
    const qty = product.stock_quantity ?? 0;
    if (qty > 0 && qty <= 5) {
      stockHtml = `<p style="font-size:13px;color:#dc2626;font-weight:500;">Últimas ${qty} unidades!</p>`;
    } else if (qty > 5) {
      stockHtml = `<p style="font-size:13px;color:#16a34a;font-weight:500;">Em estoque</p>`;
    }
  }

  // Badges
  let badgesHtml = '';
  if (showBadges) {
    const badges: string[] = [];
    if (product.free_shipping) badges.push(`<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;font-size:12px;font-weight:600;padding:4px 10px;border-radius:4px;">🚚 Frete grátis</span>`);
    if (hasDiscount) badges.push(`<span style="display:inline-flex;align-items:center;gap:4px;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;padding:4px 10px;border-radius:4px;">-${discountPercent}% OFF</span>`);
    if (badges.length > 0) {
      badgesHtml = `<div style="display:flex;flex-wrap:wrap;gap:8px;">${badges.join('')}</div>`;
    }
  }

  // WhatsApp button
  const whatsappPhone = context.storeSettings?.social_whatsapp || context.storeSettings?.contact_phone || '';
  let whatsappButtonHtml = '';
  if (showWhatsAppButton && whatsappPhone) {
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${product.name}`)}`;
    whatsappButtonHtml = `<a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 32px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;text-decoration:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Comprar pelo WhatsApp
    </a>`;
  }

  // === QUANTITY SELECTOR ===
  const inStock = (product.stock_quantity ?? 0) > 0 || product.allow_backorder;
  const quantityHtml = inStock ? `
    <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
      <span style="font-size:14px;font-weight:500;color:var(--theme-text-secondary,#555);">Quantidade:</span>
      <div style="display:flex;align-items:center;border:1px solid #ddd;border-radius:6px;overflow:hidden;">
        <button data-sf-action="qty-minus" style="width:36px;height:36px;border:none;background:#f5f5f5;cursor:pointer;font-size:18px;font-weight:600;color:#333;">−</button>
        <input type="number" value="1" min="1" max="${product.stock_quantity || 99}" data-sf-qty-input style="width:48px;height:36px;border:none;border-left:1px solid #ddd;border-right:1px solid #ddd;text-align:center;font-size:14px;font-weight:500;-moz-appearance:textfield;appearance:textfield;outline:none;">
        <button data-sf-action="qty-plus" style="width:36px;height:36px;border:none;background:#f5f5f5;cursor:pointer;font-size:18px;font-weight:600;color:#333;">+</button>
      </div>
    </div>` : '';

  // === CTA BUTTONS ===
  let ctaHtml = '';
  if (inStock) {
    const mainImageThumb = mainImage ? escapeHtml(optimizeImageUrl(mainImage.url, 120, 75)) : '';
    ctaHtml = `<div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:400px;">
      ${showAddToCartButton ? `<button data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${mainImageThumb}" style="padding:14px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%;">Adicionar ao carrinho</button>` : ''}
      ${showBuyNowButton ? `<button data-sf-action="buy-now" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${mainImageThumb}" style="padding:14px 32px;background:transparent;color:var(--theme-button-primary-bg,#1a1a1a);border:2px solid var(--theme-button-primary-bg,#1a1a1a);border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%;">${escapeHtml(buyNowButtonText)}</button>` : ''}
      ${whatsappButtonHtml}
    </div>`;
  } else {
    ctaHtml = `<p style="padding:14px;background:#fef2f2;color:#dc2626;border-radius:8px;text-align:center;font-weight:500;max-width:400px;">Produto indisponível</p>`;
  }

  // Shipping calculator
  let shippingHtml = '';
  if (showShippingCalculator) {
    shippingHtml = `
      <div style="margin-top:16px;padding:16px;background:#f9f9f9;border-radius:8px;" data-sf-shipping-box data-product-id="${product.id}" data-product-price="${product.price}" data-product-weight="${(product as any).weight || 0.3}">
        <p style="font-size:14px;font-weight:600;margin-bottom:8px;">📦 Calcular frete e prazo</p>
        <div style="display:flex;gap:8px;">
          <input type="text" placeholder="Digite seu CEP" maxlength="9" style="flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;outline:none;font-family:var(--sf-body-font);" data-sf-shipping-cep>
          <button style="padding:10px 20px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;" data-sf-action="calc-shipping">Calcular</button>
        </div>
        <div data-sf-shipping-results style="margin-top:8px;"></div>
        <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener" style="font-size:12px;color:var(--theme-text-secondary,#666);text-decoration:underline;margin-top:6px;display:inline-block;">Não sei meu CEP</a>
      </div>`;
  }

  // Additional highlight images  
  let highlightHtml = '';
  if (showAdditionalHighlight && (additionalHighlightImagesDesktop.length > 0 || additionalHighlightImagesMobile.length > 0)) {
    const desktopImgs = additionalHighlightImagesDesktop.map((img: any) => {
      const src = typeof img === 'string' ? img : img?.url || '';
      return src ? `<img src="${escapeHtml(optimizeImageUrl(src, 1200, 85))}" alt="Destaque" style="width:100%;border-radius:8px;" loading="lazy">` : '';
    }).filter(Boolean).join('');
    
    if (desktopImgs) {
      highlightHtml = `<div style="margin-top:24px;">${desktopImgs}</div>`;
    }
  }

  // JSON-LD with rating
  const jsonLdObj: Record<string, unknown> = {
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
      "availability": inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "url": `https://${context.hostname}/produto/${product.slug}`,
    }
  };
  if (product.avg_rating && product.review_count && product.review_count > 0) {
    jsonLdObj["aggregateRating"] = {
      "@type": "AggregateRating",
      "ratingValue": product.avg_rating.toFixed(1),
      "reviewCount": product.review_count,
    };
  }
  const jsonLd = JSON.stringify(jsonLdObj);

  return `
    <script type="application/ld+json">${jsonLd}</script>
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      ${breadcrumbHtml}
      <style>
        @media(min-width:768px) { .sf-pdp-grid { grid-template-columns: 1fr 1fr !important; } }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
      </style>
      <div class="sf-pdp-grid" style="display:grid;grid-template-columns:1fr;gap:32px;">
        <!-- Gallery -->
        ${showGallery ? `
        <div>
          ${optimizedMain ? `<img src="${escapeHtml(optimizedMain)}" alt="${escapeHtml(product.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:8px;background:#f9f9f9;" loading="eager" fetchpriority="high">` : ''}
          ${thumbsHtml ? `<div style="display:flex;gap:8px;margin-top:12px;overflow-x:auto;">${thumbsHtml}</div>` : ''}
        </div>
        ` : ''}
        <!-- Info -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${badgesHtml}
          <h1 style="font-size:clamp(20px,3vw,32px);font-weight:700;font-family:var(--sf-heading-font);line-height:1.3;">${escapeHtml(product.name)}</h1>
          ${ratingHtml}
          ${product.brand ? `<p style="font-size:14px;color:var(--theme-text-secondary,#666);">${escapeHtml(product.brand)}</p>` : ''}
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:14px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(product.compare_at_price!)}</span>` : ''}
            <span style="font-size:28px;font-weight:700;color:var(--theme-price-color, var(--theme-text-primary,#1a1a1a));">${formatPriceFromDecimal(product.price)}</span>
            ${hasDiscount ? `<span style="font-size:13px;font-weight:600;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:4px;">-${discountPercent}%</span>` : ''}
          </div>
          <p style="font-size:13px;color:#666;">em até 12x de ${installmentValue} sem juros</p>
          ${product.short_description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#555);line-height:1.6;">${escapeHtml(product.short_description)}</p>` : ''}
          ${stockHtml}
          ${quantityHtml}
          ${ctaHtml}
          ${shippingHtml}
          ${highlightHtml}
        </div>
      </div>
      ${showDescription && product.description ? `
        <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;">
          <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);margin-bottom:16px;">Descrição</h2>
          <div style="font-size:15px;line-height:1.8;color:var(--theme-text-secondary,#444);">${product.description}</div>
        </div>
      ` : ''}
    </div>`;
};
