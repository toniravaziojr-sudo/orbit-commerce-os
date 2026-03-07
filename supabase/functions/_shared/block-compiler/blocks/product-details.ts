// =============================================
// PRODUCT DETAILS COMPILER — Block compiler for ProductDetails
// Mirrors: src/components/builder/BlockRenderer.tsx ProductDetailsBlock
// Renders product gallery, info, price, CTA, description, and sections
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl, formatPriceFromDecimal } from '../utils.ts';

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
  const showVariants = ps.showVariants ?? true;
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
    whatsappButtonHtml = `<a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 32px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;max-width:400px;text-decoration:none;">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Comprar pelo WhatsApp
    </a>`;
  }

  // Shipping calculator placeholder
  let shippingHtml = '';
  if (showShippingCalculator) {
    shippingHtml = `
      <div style="margin-top:16px;padding:16px;background:#f9f9f9;border-radius:8px;">
        <p style="font-size:14px;font-weight:600;margin-bottom:8px;">📦 Calcular frete e prazo</p>
        <div style="display:flex;gap:8px;">
          <input type="text" placeholder="Digite seu CEP" maxlength="9" style="flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;outline:none;font-family:var(--sf-body-font);" data-sf-shipping-cep>
          <button style="padding:10px 20px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;" data-sf-action="calc-shipping" data-product-id="${product.id}">Calcular</button>
        </div>
        <div data-sf-shipping-results style="margin-top:8px;"></div>
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
      "url": `https://${context.hostname}/produto/${product.slug}`,
    }
  });

  return `
    <script type="application/ld+json">${jsonLd}</script>
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      <style>
        @media(min-width:768px) { .sf-pdp-grid { grid-template-columns: 1fr 1fr !important; } }
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
          ${product.brand ? `<p style="font-size:14px;color:var(--theme-text-secondary,#666);">${escapeHtml(product.brand)}</p>` : ''}
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:14px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(product.compare_at_price!)}</span>` : ''}
            <span style="font-size:28px;font-weight:700;color:var(--theme-price-color, var(--theme-text-primary,#1a1a1a));">${formatPriceFromDecimal(product.price)}</span>
            ${hasDiscount ? `<span style="font-size:13px;font-weight:600;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:4px;">-${discountPercent}%</span>` : ''}
          </div>
          <p style="font-size:13px;color:#666;">em até 12x de ${installmentValue} sem juros</p>
          ${product.short_description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#555);line-height:1.6;">${escapeHtml(product.short_description)}</p>` : ''}
          ${stockHtml}
          ${(product.stock_quantity ?? 0) > 0
            ? `<div style="display:flex;flex-direction:column;gap:8px;max-width:400px;">
                ${showAddToCartButton ? `<button data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${escapeHtml(optimizeImageUrl(mainImage?.url, 120, 75))}" style="padding:14px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%;">Adicionar ao carrinho</button>` : ''}
                ${whatsappButtonHtml}
               </div>`
            : `<p style="padding:14px;background:#fef2f2;color:#dc2626;border-radius:8px;text-align:center;font-weight:500;max-width:400px;">Produto indisponível</p>`
          }
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
