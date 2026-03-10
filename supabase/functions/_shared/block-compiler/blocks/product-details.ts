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
    crumbs.push(`<a href="/" style="color:#666;text-decoration:none;font-size:13px;">Início</a>`);
    if (category) {
      crumbs.push(`<span style="color:#999;font-size:12px;">›</span>`);
      crumbs.push(`<a href="/categoria/${escapeHtml(category.slug)}" style="color:#666;text-decoration:none;font-size:13px;">${escapeHtml(category.name)}</a>`);
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

  // Pix badge (mirrors PaymentBadges.tsx)
  const pixDiscountPercent = 10;
  const pixPrice = product.price * (1 - pixDiscountPercent / 100);
  const pixBadgeHtml = `
    <div style="space-y:8px;">
      <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);">
        <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--theme-accent-color,#22c55e);display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><rect width="5" height="5" x="16" y="16" rx="1"/></svg>
        </div>
        <div style="flex:1;">
          <p style="font-size:14px;font-weight:700;color:var(--theme-accent-color,#22c55e);">${formatPriceFromDecimal(pixPrice)} no Pix</p>
          <p style="font-size:12px;color:var(--theme-accent-color,#22c55e);opacity:0.8;">${pixDiscountPercent}% de desconto</p>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
        <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f5f5f5;border-radius:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          <span style="font-size:12px;color:#666;">12x de ${installmentValue}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f5f5f5;border-radius:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>
          <span style="font-size:12px;color:#666;">Boleto</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#f5f5f5;border-radius:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
          <span style="font-size:12px;color:#666;">Débito</span>
        </div>
      </div>
    </div>`;

  // Stock info — mirrors SPA: "Estoque: X unidades"
  let stockHtml = '';
  if (showStock) {
    const qty = product.stock_quantity ?? 0;
    if (qty > 0) {
      stockHtml = `<p style="font-size:13px;color:var(--theme-text-secondary,#666);" data-sf-stock-text>Estoque: ${qty} unidades</p>`;
    }
  }

  // === VARIANT SELECTOR ===
  const showVariants = ps.showVariants ?? true;
  const variants = context.currentProductVariants || [];
  let variantSelectorHtml = '';
  if (showVariants && variants.length > 0) {
    // Extract option groups from variants
    const groupsMap = new Map<string, Set<string>>();
    for (const v of variants) {
      if (v.option1_name && v.option1_value) {
        if (!groupsMap.has(v.option1_name)) groupsMap.set(v.option1_name, new Set());
        groupsMap.get(v.option1_name)!.add(v.option1_value);
      }
      if (v.option2_name && v.option2_value) {
        if (!groupsMap.has(v.option2_name)) groupsMap.set(v.option2_name, new Set());
        groupsMap.get(v.option2_name)!.add(v.option2_value);
      }
      if (v.option3_name && v.option3_value) {
        if (!groupsMap.has(v.option3_name)) groupsMap.set(v.option3_name, new Set());
        groupsMap.get(v.option3_name)!.add(v.option3_value);
      }
    }

    const groupsHtml = Array.from(groupsMap.entries()).map(([name, valuesSet]) => {
      const values = Array.from(valuesSet);
      const buttonsHtml = values.map(value =>
        `<button type="button" data-sf-variant-option data-option-name="${escapeHtml(name)}" data-option-value="${escapeHtml(value)}" style="padding:8px 16px;font-size:14px;font-weight:500;border-radius:6px;border:1px solid #ddd;background:#fff;color:#1a1a1a;cursor:pointer;transition:all .15s;">${escapeHtml(value)}</button>`
      ).join('');
      return `<div data-sf-variant-group="${escapeHtml(name)}" style="margin-bottom:12px;">
        <label style="font-size:14px;font-weight:500;color:#1a1a1a;display:block;margin-bottom:6px;">${escapeHtml(name)}: <span data-sf-variant-selected-label="${escapeHtml(name)}" style="font-weight:400;color:#666;"></span></label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${buttonsHtml}</div>
      </div>`;
    }).join('');

    // Embed variant data as JSON for hydration
    const variantData = variants.map(v => ({
      id: v.id, sku: v.sku || '', price: v.price, compare_at_price: v.compare_at_price,
      stock_quantity: v.stock_quantity, image_url: v.image_url || '',
      o1n: v.option1_name, o1v: v.option1_value,
      o2n: v.option2_name, o2v: v.option2_value,
      o3n: v.option3_name, o3v: v.option3_value,
    }));

    variantSelectorHtml = `
      <div data-sf-variant-selector style="margin-top:4px;">
        ${groupsHtml}
        <script type="application/json" data-sf-variant-data>${JSON.stringify(variantData)}</script>
      </div>`;
  }

  // Badges — mirrors SPA ProductBadges.tsx (NO discount badge here, discount is shown inline with price)
  // Uses SVG icons instead of emojis for visual parity with Builder
  let badgesHtml = '';
  if (showBadges) {
    const badges: string[] = [];
    if (product.free_shipping) badges.push(`<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;font-size:12px;font-weight:600;padding:4px 10px;border-radius:4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg> Frete Grátis</span>`);
    // NOTE: Discount badge intentionally NOT shown here — per REGRAS.md, discounts are shown inline with price
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
      <span style="font-size:14px;font-weight:500;color:#555;">Quantidade:</span>
      <div style="display:flex;align-items:center;border:1px solid #ddd;border-radius:6px;overflow:hidden;">
        <button data-sf-action="qty-minus" style="width:36px;height:36px;border:none;background:#f5f5f5;cursor:pointer;font-size:18px;font-weight:600;color:#333;">−</button>
        <input type="number" value="1" min="1" max="${product.stock_quantity || 99}" data-sf-qty-input style="width:48px;height:36px;border:none;border-left:1px solid #ddd;border-right:1px solid #ddd;text-align:center;font-size:14px;font-weight:500;-moz-appearance:textfield;appearance:textfield;outline:none;">
        <button data-sf-action="qty-plus" style="width:36px;height:36px;border:none;background:#f5f5f5;cursor:pointer;font-size:18px;font-weight:600;color:#333;">+</button>
      </div>
    </div>` : '';

  // === CTA BUTTONS === (Order matches SPA: Buy Now → Add to Cart → WhatsApp)
  let ctaHtml = '';
  if (inStock) {
    const mainImageThumb = mainImage ? escapeHtml(optimizeImageUrl(mainImage.url, 120, 75)) : '';
    ctaHtml = `<div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:400px;">
      ${showBuyNowButton ? `<button type="button" data-sf-action="buy-now" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${mainImageThumb}" class="sf-btn-primary" style="padding:14px 32px;border:none;border-radius:9999px;font-size:16px;font-weight:600;cursor:pointer;width:100%;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(buyNowButtonText)}</button>` : ''}
      ${showAddToCartButton ? `<button type="button" data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${mainImageThumb}" class="sf-btn-secondary" style="padding:14px 32px;border-radius:9999px;font-size:16px;font-weight:600;cursor:pointer;width:100%;border:2px solid var(--theme-button-primary-bg,#1a1a1a);text-transform:uppercase;letter-spacing:0.05em;">Adicionar ao carrinho</button>` : ''}
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

  // === BUY TOGETHER SECTION ===
  let buyTogetherHtml = '';
  if (showBuyTogether && context.currentBuyTogether) {
    const bt = context.currentBuyTogether;
    const sp = bt.suggestedProduct;
    const mainImg = mainImage ? optimizeImageUrl(mainImage.url, 200, 80) : '';
    const spImg = sp.image_url ? optimizeImageUrl(sp.image_url, 200, 80) : '';
    
    const originalTotal = product.price + sp.price;
    let comboPrice = originalTotal;
    if (bt.discount_type === 'percentage') {
      comboPrice = originalTotal * (1 - bt.discount_value / 100);
    } else if (bt.discount_type === 'fixed') {
      comboPrice = Math.max(0, originalTotal - bt.discount_value);
    }
    const savings = originalTotal - comboPrice;

    buyTogetherHtml = `
      <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;">
        <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);margin-bottom:20px;">${escapeHtml(bt.title || 'Compre Junto')}</h2>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #eee;">
          <div style="text-align:center;flex:1;min-width:120px;">
            ${mainImg ? `<img src="${escapeHtml(mainImg)}" alt="${escapeHtml(product.name)}" style="width:100px;height:100px;object-fit:contain;margin:0 auto;border-radius:8px;">` : ''}
            <p style="font-size:13px;font-weight:500;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;margin-left:auto;margin-right:auto;">${escapeHtml(product.name)}</p>
            <p style="font-size:14px;font-weight:600;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(product.price)}</p>
          </div>
          <span style="font-size:28px;font-weight:700;color:var(--theme-button-primary-bg,#1a1a1a);">+</span>
          <div style="text-align:center;flex:1;min-width:120px;">
            ${spImg ? `<img src="${escapeHtml(spImg)}" alt="${escapeHtml(sp.name)}" style="width:100px;height:100px;object-fit:contain;margin:0 auto;border-radius:8px;">` : ''}
            <p style="font-size:13px;font-weight:500;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;margin-left:auto;margin-right:auto;">${escapeHtml(sp.name)}</p>
            <p style="font-size:14px;font-weight:600;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(sp.price)}</p>
          </div>
          <div style="text-align:center;flex:1;min-width:160px;padding:16px;background:#fff;border-radius:8px;border:1px solid #eee;">
            <p style="font-size:13px;color:#666;margin-bottom:4px;">Comprando juntos</p>
            ${savings > 0 ? `<p style="font-size:13px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(originalTotal)}</p>` : ''}
            <p style="font-size:22px;font-weight:700;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(comboPrice)}</p>
            ${savings > 0 ? `<p style="font-size:12px;color:#16a34a;font-weight:600;">Economize ${formatPriceFromDecimal(savings)}</p>` : ''}
            <button data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${escapeHtml(mainImg)}" data-extra-product-id="${sp.id}" data-extra-product-name="${escapeHtml(sp.name)}" data-extra-product-price="${sp.price}" data-extra-product-image="${escapeHtml(spImg)}" class="sf-btn-primary" style="margin-top:12px;padding:12px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:100%;">Adicionar ambos ao carrinho</button>
          </div>
        </div>
      </div>`;
  }

  // === REVIEWS SECTION ===
  let reviewsSectionHtml = '';
  const reviewsList = context.currentProductReviews || [];
  if (showReviews && reviewsList.length > 0) {
    const totalReviews = reviewsList.length;
    const avgRating = reviewsList.reduce((s, r) => s + r.rating, 0) / totalReviews;
    
    // Distribution
    const dist = [5, 4, 3, 2, 1].map(star => {
      const count = reviewsList.filter(r => r.rating === star).length;
      return { star, count, pct: Math.round((count / totalReviews) * 100) };
    });

    const distBarsHtml = dist.map(d =>
      `<div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;font-weight:500;width:12px;text-align:right;">${d.star}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
          <div style="width:${d.pct}%;height:100%;background:#facc15;border-radius:4px;"></div>
        </div>
        <span style="font-size:12px;color:#666;width:24px;text-align:right;">${d.count}</span>
      </div>`
    ).join('');

    const reviewCardsHtml = reviewsList.slice(0, 10).map(r => {
      const starsHtml = renderStars(r.rating);
      const dateStr = new Date(r.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
      const verifiedHtml = r.is_verified_purchase
        ? `<span style="display:inline-flex;align-items:center;gap:3px;color:#16a34a;font-size:12px;">✓ Compra verificada</span>`
        : '';
      const mediaHtml = r.media_urls && r.media_urls.length > 0
        ? `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">${r.media_urls.map(url => 
            `<img src="${escapeHtml(optimizeImageUrl(url, 120, 75))}" alt="Mídia" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #eee;" loading="lazy">`
          ).join('')}</div>`
        : '';
      return `<div style="padding:16px;border:1px solid #eee;border-radius:12px;background:#fff;">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:8px;">${starsHtml}</div>
        ${r.title ? `<h4 style="font-size:14px;font-weight:600;margin-bottom:4px;">${escapeHtml(r.title)}</h4>` : ''}
        ${r.content ? `<p style="font-size:14px;color:#555;line-height:1.6;">${escapeHtml(r.content)}</p>` : ''}
        ${mediaHtml}
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;color:#888;">
          <span style="font-weight:500;color:#444;">${escapeHtml(r.customer_name)}</span>
          <span>•</span>
          <span>${dateStr}</span>
          ${verifiedHtml}
        </div>
      </div>`;
    }).join('');

    reviewsSectionHtml = `
      <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;" id="reviews-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);">Avaliações</h2>
          <span style="font-size:14px;color:#666;margin-left:auto;">(${totalReviews} avaliação${totalReviews > 1 ? 'ões' : ''})</span>
        </div>
        <div style="display:flex;gap:24px;margin-bottom:24px;padding:20px;background:#f9fafb;border-radius:12px;border:1px solid #eee;flex-wrap:wrap;">
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:120px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:-1px;">${avgRating.toFixed(1).replace('.', ',')}</span>
            <div style="display:flex;align-items:center;gap:1px;margin-top:4px;">${renderStars(avgRating)}</div>
            <span style="font-size:12px;color:#666;margin-top:4px;">${totalReviews} avaliação${totalReviews > 1 ? 'ões' : ''}</span>
          </div>
          <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px;">${distBarsHtml}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">${reviewCardsHtml}</div>
      </div>`;
  } else if (showReviews && reviewsList.length === 0) {
    // Empty state
    reviewsSectionHtml = `
      <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;" id="reviews-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);">Avaliações</h2>
        </div>
        <div style="text-align:center;padding:40px 16px;color:#999;background:#f9fafb;border-radius:12px;border:1px dashed #ddd;">
          <p style="font-weight:500;">Ainda não há avaliações para este produto.</p>
          <p style="font-size:13px;margin-top:4px;">Seja o primeiro a avaliar!</p>
        </div>
      </div>`;
  }

  // === RELATED PRODUCTS SECTION ===
  // Inherits visual settings from categorySettings for parity with category page
  let relatedHtml = '';
  const relatedProducts = context.currentRelatedProducts || [];
  if (showRelatedProducts && relatedProducts.length > 0) {
    const cs = context.categorySettings || {};
    const rpShowRatings = cs.showRatings ?? true;
    const rpShowBadges = cs.showBadges ?? true;
    const rpShowAddToCart = cs.showAddToCartButton ?? true;
    const rpQuickBuyEnabled = cs.quickBuyEnabled ?? false;
    const rpBuyNowText = cs.buyNowButtonText || 'Comprar agora';

    const relatedCardsHtml = relatedProducts.map(rp => {
      const rpImg = rp.image_url ? optimizeImageUrl(rp.image_url, 400, 80) : '';
      const rpHasDiscount = rp.compare_at_price && rp.compare_at_price > rp.price;
      const rpDiscountPct = rpHasDiscount ? Math.round((1 - rp.price / rp.compare_at_price!) * 100) : 0;

      // Badges (inheriting categorySettings.showBadges)
      let rpBadgesHtml = '';
      if (rpShowBadges) {
        const badges: string[] = [];
        if (rp.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">FRETE GRÁTIS</span>`);
        if (rpHasDiscount && rpDiscountPct >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;white-space:nowrap;">-${rpDiscountPct}%</span>`);
        if (badges.length > 0) {
          rpBadgesHtml = `<div style="position:absolute;top:6px;left:6px;right:6px;display:flex;align-items:center;gap:4px;z-index:2;pointer-events:none;flex-wrap:nowrap;overflow:hidden;">${badges.join('')}</div>`;
        }
      }

      // Ratings (inheriting categorySettings.showRatings)
      let rpRatingHtml = '';
      if (rpShowRatings && rp.avg_rating && rp.review_count && rp.review_count > 0) {
        const fullStars = Math.floor(rp.avg_rating);
        const halfStar = rp.avg_rating % 1 >= 0.5;
        const stars = '★'.repeat(fullStars) + (halfStar ? '☆' : '');
        rpRatingHtml = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
          <span style="color:#f59e0b;font-size:12px;letter-spacing:1px;">${stars}</span>
          <span style="font-size:11px;color:#666;">(${rp.review_count})</span>
        </div>`;
      }

      // Buttons (inheriting categorySettings: addToCart, quickBuy)
      const rpButtonsHtml: string[] = [];
      if (rpShowAddToCart) {
        rpButtonsHtml.push(`<button type="button" data-sf-action="add-to-cart" data-product-id="${rp.id}" data-product-name="${escapeHtml(rp.name)}" data-product-price="${rp.price}" data-product-image="${escapeHtml(rpImg)}" class="sf-btn-outline-primary" style="width:100%;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Adicionar
        </button>`);
      }
      if (rpQuickBuyEnabled) {
        rpButtonsHtml.push(`<button type="button" data-sf-action="buy-now" data-product-id="${rp.id}" data-product-name="${escapeHtml(rp.name)}" data-product-price="${rp.price}" data-product-image="${escapeHtml(rpImg)}" class="sf-btn-primary" style="width:100%;padding:8px;border:none;border-radius:6px;font-size:12px;text-align:center;font-weight:500;cursor:pointer;min-height:36px;">${escapeHtml(rpBuyNowText)}</button>`);
      }

      return `<div class="sf-cat-card" style="min-width:0;">
        <a href="/produto/${escapeHtml(rp.slug)}" class="sf-cat-card-link" style="display:flex;flex-direction:column;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;border:1px solid var(--theme-card-border,#f0f0f0);transition:box-shadow .2s;position:relative;height:100%;background:var(--theme-card-bg,#fff);">
          ${rpBadgesHtml}
          <div style="aspect-ratio:1;background:#f9f9f9;overflow:hidden;">
            ${rpImg ? `<img src="${escapeHtml(rpImg)}" alt="${escapeHtml(rp.name)}" style="width:100%;height:100%;object-fit:cover;transition:transform .3s;" loading="lazy">` : ''}
          </div>
          <div style="padding:8px 12px 12px;flex:1;display:flex;flex-direction:column;">
            ${rpRatingHtml}
            <p style="font-size:13px;font-weight:500;line-height:1.4;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(rp.name)}</p>
            <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:auto;">
              ${rpHasDiscount ? `<span style="font-size:11px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(rp.compare_at_price!)}</span>` : ''}
              <span style="font-size:14px;font-weight:700;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(rp.price)}</span>
              ${rpHasDiscount ? `<span style="font-size:10px;font-weight:600;color:#16a34a;background:#dcfce7;padding:1px 6px;border-radius:3px;">-${rpDiscountPct}%</span>` : ''}
            </div>
            ${rpButtonsHtml.length > 0 ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;" onclick="event.preventDefault();event.stopPropagation();">${rpButtonsHtml.join('')}</div>` : ''}
          </div>
        </a>
      </div>`;
    }).join('');

    relatedHtml = `
      <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;">
        <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);margin-bottom:20px;">${escapeHtml(relatedProductsTitle)}</h2>
        <style>
          .sf-related-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
          @media(min-width:640px){.sf-related-grid{grid-template-columns:repeat(2,1fr)!important}}
          @media(min-width:1024px){.sf-related-grid{grid-template-columns:repeat(4,1fr)!important}}
          .sf-cat-card-link:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);}
          .sf-cat-card-link:hover img{transform:scale(1.05);}
        </style>
        <div class="sf-related-grid">${relatedCardsHtml}</div>
      </div>`;
  }

  return `
    <script type="application/ld+json">${jsonLd}</script>
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      ${breadcrumbHtml}
      <style>
        @media(min-width:768px) { .sf-pdp-grid { grid-template-columns: 1fr 1fr !important; } }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        .sf-gallery-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;}
        .sf-gallery-track::-webkit-scrollbar{display:none;}
        .sf-gallery-slide{flex:0 0 100%;scroll-snap-align:start;}
        .sf-gallery-dots{display:flex;justify-content:center;gap:6px;margin-top:10px;}
        .sf-gallery-dot{width:8px;height:8px;border-radius:50%;background:#d1d5db;border:none;padding:0;cursor:pointer;transition:background .2s;}
        .sf-gallery-dot.active{background:var(--theme-button-primary-bg,#1a1a1a);}
        @media(min-width:768px){.sf-gallery-mobile{display:none!important;}.sf-gallery-desktop{display:block!important;}}
        @media(max-width:767px){.sf-gallery-mobile{display:block!important;}.sf-gallery-desktop{display:none!important;}}
        .sf-lightbox-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);display:none;align-items:center;justify-content:center;flex-direction:column;}
        .sf-lightbox-overlay.open{display:flex;}
        .sf-lightbox-img{max-width:90vw;max-height:80vh;object-fit:contain;transition:transform 0.2s ease;touch-action:none;user-select:none;-webkit-user-select:none;}
        .sf-lightbox-controls{position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:10;}
        .sf-lightbox-btn{width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;backdrop-filter:blur(4px);transition:background .2s;}
        .sf-lightbox-btn:hover{background:rgba(255,255,255,0.3);}
        .sf-lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:50%;width:44px;height:44px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;backdrop-filter:blur(4px);transition:background .2s;}
        .sf-lightbox-nav:hover{background:rgba(255,255,255,0.3);}
        .sf-lightbox-nav.prev{left:16px;}
        .sf-lightbox-nav.next{right:16px;}
        .sf-lightbox-counter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:14px;background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:20px;}
      </style>
      ${showGallery ? `
      <!-- Lightbox overlay -->
      <div class="sf-lightbox-overlay" data-sf-lightbox>
        <div class="sf-lightbox-controls">
          <button class="sf-lightbox-btn" data-sf-lightbox-zoom-out title="Reduzir">−</button>
          <button class="sf-lightbox-btn" data-sf-lightbox-zoom-in title="Ampliar">+</button>
          <button class="sf-lightbox-btn" data-sf-lightbox-close title="Fechar">✕</button>
        </div>
        ${images.length > 1 ? `
          <button class="sf-lightbox-nav prev" data-sf-lightbox-prev>‹</button>
          <button class="sf-lightbox-nav next" data-sf-lightbox-next>›</button>
        ` : ''}
        <img class="sf-lightbox-img" data-sf-lightbox-img src="" alt="">
        ${images.length > 1 ? `<div class="sf-lightbox-counter" data-sf-lightbox-counter></div>` : ''}
      </div>
      ` : ''}
      <div class="sf-pdp-grid" style="display:grid;grid-template-columns:1fr;gap:32px;">
        <!-- Gallery -->
        ${showGallery ? `
        <div>
          <!-- Desktop gallery (static) -->
          <div class="sf-gallery-desktop" style="display:block;">
            ${optimizedMain ? `<img src="${escapeHtml(optimizedMain)}" alt="${escapeHtml(product.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:8px;background:#f9f9f9;cursor:zoom-in;" loading="eager" fetchpriority="high" data-sf-gallery-main data-sf-lightbox-trigger="0">` : ''}
            ${thumbsHtml ? `<div style="display:flex;gap:8px;margin-top:12px;overflow-x:auto;" data-sf-gallery-thumbs>${thumbsHtml}</div>` : ''}
          </div>
          <!-- Mobile gallery (swipeable carousel) -->
          <div class="sf-gallery-mobile" style="display:none;position:relative;">
            <div class="sf-gallery-track" data-sf-gallery-track>
              ${[mainImage, ...otherImages].filter(Boolean).map((img, idx) => {
                const src = optimizeImageUrl(img!.url, 800, 85);
                return `<div class="sf-gallery-slide"><img src="${escapeHtml(src)}" alt="${escapeHtml(img!.alt_text || product.name)}" style="width:100%;aspect-ratio:1;object-fit:contain;background:#f9f9f9;border-radius:8px;cursor:zoom-in;" ${idx === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} data-sf-gallery-slide-img data-sf-lightbox-trigger="${idx}"></div>`;
              }).join('')}
            </div>
            ${images.length > 1 ? `<div class="sf-gallery-dots" data-sf-gallery-dots>
              ${[mainImage, ...otherImages].filter(Boolean).map((_, idx) =>
                `<button class="sf-gallery-dot${idx === 0 ? ' active' : ''}" data-sf-dot-index="${idx}" aria-label="Imagem ${idx + 1}"></button>`
              ).join('')}
            </div>` : ''}
          </div>
        </div>
        ` : ''}
        <!-- Info — Order mirrors Builder SPA: Badges → Stars → Title → Price -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${badgesHtml}
          ${ratingHtml}
          <h1 style="font-size:clamp(20px,3vw,32px);font-weight:700;font-family:var(--sf-heading-font);line-height:1.3;">${escapeHtml(product.name)}</h1>
          ${product.brand ? `<p style="font-size:14px;color:var(--theme-text-secondary,#666);">${escapeHtml(product.brand)}</p>` : ''}
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:14px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(product.compare_at_price!)}</span>` : ''}
            <span style="font-size:28px;font-weight:700;color:var(--theme-price-color,#1a1a1a);">${formatPriceFromDecimal(product.price)}</span>
            ${hasDiscount ? `<span style="font-size:13px;font-weight:600;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:4px;">-${discountPercent}%</span>` : ''}
          </div>
          ${pixBadgeHtml}
          ${product.short_description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#555);line-height:1.6;">${escapeHtml(product.short_description)}</p>` : ''}
          ${stockHtml}
          ${variantSelectorHtml}
          ${quantityHtml}
          ${ctaHtml}
          ${shippingHtml}
          ${highlightHtml}
        </div>
      </div>
      ${buyTogetherHtml}
      ${showDescription && product.description ? `
        <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;">
          <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);margin-bottom:16px;">Descrição</h2>
          <div style="font-size:15px;line-height:1.8;color:var(--theme-text-secondary,#444);">${product.description}</div>
        </div>
      ` : ''}
      ${reviewsSectionHtml}
      ${relatedHtml}
    </div>`;
};
