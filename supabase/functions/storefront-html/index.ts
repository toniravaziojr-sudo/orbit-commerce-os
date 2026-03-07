// ============================================
// STOREFRONT HTML — Edge-Rendered Storefront
// v2.0.0: Home + Product + Category routes
// Resolves tenant from hostname, renders full HTML
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

// ===== VERSION =====
const VERSION = "v3.0.0"; // Phase 3: Hydration script + interactive elements
// ====================

// ============================================
// FONT MAP
// ============================================
const FONT_FAMILY_MAP: Record<string, string> = {
  'inter': "'Inter', sans-serif",
  'roboto': "'Roboto', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  'lato': "'Lato', sans-serif",
  'montserrat': "'Montserrat', sans-serif",
  'poppins': "'Poppins', sans-serif",
  'nunito': "'Nunito', sans-serif",
  'raleway': "'Raleway', sans-serif",
  'mulish': "'Mulish', sans-serif",
  'work-sans': "'Work Sans', sans-serif",
  'quicksand': "'Quicksand', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  'manrope': "'Manrope', sans-serif",
  'outfit': "'Outfit', sans-serif",
  'plus-jakarta-sans': "'Plus Jakarta Sans', sans-serif",
  'playfair': "'Playfair Display', serif",
  'merriweather': "'Merriweather', serif",
  'lora': "'Lora', serif",
  'oswald': "'Oswald', sans-serif",
  'bebas-neue': "'Bebas Neue', sans-serif",
};

function getFontFamily(fontValue: string): string {
  return FONT_FAMILY_MAP[fontValue] || FONT_FAMILY_MAP['inter'];
}

// ============================================
// IMAGE OPTIMIZATION (wsrv.nl proxy)
// ============================================
function optimizeImageUrl(url: string | undefined | null, width: number, quality = 80): string {
  if (!url) return '';
  if (url.startsWith('https://wsrv.nl') || url.startsWith('data:')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&output=webp`;
}

// ============================================
// THEME CSS GENERATOR
// ============================================
function generateThemeCss(themeSettings: any): string {
  const typography = themeSettings?.typography;
  const colors = themeSettings?.colors;
  
  const headingFont = getFontFamily(typography?.headingFont || 'inter');
  const bodyFont = getFontFamily(typography?.bodyFont || 'inter');
  const baseFontSize = typography?.baseFontSize || 16;
  
  const colorVars: string[] = [];
  if (colors?.buttonPrimaryBg) colorVars.push(`--theme-button-primary-bg: ${colors.buttonPrimaryBg};`);
  if (colors?.buttonPrimaryText) colorVars.push(`--theme-button-primary-text: ${colors.buttonPrimaryText};`);
  if (colors?.buttonPrimaryHover) colorVars.push(`--theme-button-primary-hover: ${colors.buttonPrimaryHover};`);
  if (colors?.textPrimary) colorVars.push(`--theme-text-primary: ${colors.textPrimary};`);
  if (colors?.textSecondary) colorVars.push(`--theme-text-secondary: ${colors.textSecondary};`);

  return `
    :root {
      --sf-heading-font: ${headingFont};
      --sf-body-font: ${bodyFont};
      --sf-base-font-size: ${baseFontSize}px;
      ${colorVars.join('\n      ')}
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--sf-body-font);
      font-size: var(--sf-base-font-size);
      color: var(--theme-text-primary, #1a1a1a);
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    h1,h2,h3,h4,h5,h6 { font-family: var(--sf-heading-font); }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; height: auto; display: block; }
  `;
}

// ============================================
// GOOGLE FONTS LINK GENERATOR
// ============================================
function getGoogleFontsLink(themeSettings: any): string {
  const fonts = new Set<string>();
  const headingFont = themeSettings?.typography?.headingFont || 'inter';
  const bodyFont = themeSettings?.typography?.bodyFont || 'inter';
  
  const fontNameMap: Record<string, string> = {
    'inter': 'Inter', 'roboto': 'Roboto', 'open-sans': 'Open+Sans', 'lato': 'Lato',
    'montserrat': 'Montserrat', 'poppins': 'Poppins', 'nunito': 'Nunito', 'raleway': 'Raleway',
    'mulish': 'Mulish', 'work-sans': 'Work+Sans', 'quicksand': 'Quicksand', 'dm-sans': 'DM+Sans',
    'manrope': 'Manrope', 'outfit': 'Outfit', 'plus-jakarta-sans': 'Plus+Jakarta+Sans',
    'playfair': 'Playfair+Display', 'merriweather': 'Merriweather', 'lora': 'Lora',
    'oswald': 'Oswald', 'bebas-neue': 'Bebas+Neue',
  };
  
  if (fontNameMap[headingFont]) fonts.add(fontNameMap[headingFont]);
  if (fontNameMap[bodyFont]) fonts.add(fontNameMap[bodyFont]);
  
  if (fonts.size === 0) return '';
  const families = Array.from(fonts).map(f => `family=${f}:wght@400;500;600;700`).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}

// ============================================
// BLOCK TREE WALKER — Extract first Banner/HeroBanner
// ============================================
interface BannerData {
  type: 'Banner' | 'HeroBanner';
  imageDesktop?: string;
  imageMobile?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  linkUrl?: string;
  height?: string;
  overlayOpacity?: number;
  textColor?: string;
  alignment?: string;
  slides?: any[];
  mode?: string;
}

function findFirstBanner(node: any): BannerData | null {
  if (!node) return null;
  if (node.type === 'Banner' || node.type === 'HeroBanner') {
    return { type: node.type, ...node.props };
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findFirstBanner(child);
      if (found) return found;
    }
  }
  return null;
}

// ============================================
// UTILITY
// ============================================
function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatPriceFromDecimal(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// ============================================
// ROUTE PARSER
// ============================================
interface ParsedRoute {
  type: 'home' | 'product' | 'category' | 'page' | 'unknown';
  slug?: string;
}

function parseRoute(path: string): ParsedRoute {
  const clean = path.replace(/^\/+|\/+$/g, '').toLowerCase();
  
  if (!clean || clean === '/') return { type: 'home' };
  
  // /produto/:slug
  const productMatch = clean.match(/^produto\/(.+)$/);
  if (productMatch) return { type: 'product', slug: productMatch[1] };
  
  // /categoria/:slug
  const categoryMatch = clean.match(/^categoria\/(.+)$/);
  if (categoryMatch) return { type: 'category', slug: categoryMatch[1] };
  
  // /p/:slug (institutional pages) — skip for now
  const pageMatch = clean.match(/^p\/(.+)$/);
  if (pageMatch) return { type: 'page', slug: pageMatch[1] };
  
  // Known non-page routes
  const knownRoutes = ['carrinho', 'checkout', 'obrigado', 'rastreio', 'blog', 'minha-conta'];
  if (knownRoutes.some(r => clean === r || clean.startsWith(r + '/'))) {
    return { type: 'unknown' };
  }
  
  // Fallback: could be an institutional page
  return { type: 'page', slug: clean };
}

// ============================================
// HTML RENDERERS
// ============================================

function renderHeader(
  storeSettings: any, 
  tenant: any, 
  menuItems: any[],
  categories: any[],
  tenantSlug: string
): string {
  const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
  const logoUrl = storeSettings?.logo_url || tenant?.logo_url;
  const optimizedLogo = logoUrl ? optimizeImageUrl(logoUrl, 200, 90) : '';
  
  const navItems = menuItems
    .filter((item: any) => !item.parent_id)
    .slice(0, 8)
    .map((item: any) => {
      const url = item.url || '#';
      return `<a href="${escapeHtml(url)}" style="color:var(--theme-text-primary,#1a1a1a);font-size:14px;font-weight:500;white-space:nowrap;">${escapeHtml(item.label)}</a>`;
    })
    .join('');

  const logoHtml = optimizedLogo
    ? `<img src="${escapeHtml(optimizedLogo)}" alt="${escapeHtml(storeName)}" style="max-height:48px;width:auto;" loading="eager" fetchpriority="high">`
    : `<span style="font-size:20px;font-weight:700;font-family:var(--sf-heading-font);">${escapeHtml(storeName)}</span>`;

  return `
    <header style="background:#fff;border-bottom:1px solid #eee;padding:12px 0;position:sticky;top:0;z-index:50;">
      <div style="max-width:1280px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <a href="/" style="flex-shrink:0;">${logoHtml}</a>
        <nav style="display:flex;align-items:center;gap:24px;overflow-x:auto;">${navItems}</nav>
        <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
      </div>
    </header>`;
}

function renderBanner(banner: BannerData): string {
  if (!banner) return '';

  const heightMap: Record<string, string> = {
    sm: '300px', md: '400px', lg: '500px', full: '100vh', auto: 'auto',
  };

  let imageDesktop = banner.imageDesktop;
  let imageMobile = banner.imageMobile;
  let title = banner.title;
  let subtitle = banner.subtitle;
  let buttonText = banner.buttonText;
  let buttonUrl = banner.buttonUrl;
  let linkUrl = banner.linkUrl;
  
  if (banner.mode === 'carousel' && banner.slides && banner.slides.length > 0) {
    const firstSlide = banner.slides[0];
    imageDesktop = firstSlide.imageDesktop || imageDesktop;
    imageMobile = firstSlide.imageMobile || imageMobile;
    title = firstSlide.title || title;
    subtitle = firstSlide.subtitle || subtitle;
    buttonText = firstSlide.buttonText || buttonText;
    buttonUrl = firstSlide.buttonUrl || buttonUrl;
    linkUrl = firstSlide.linkUrl || linkUrl;
  }

  const height = heightMap[banner.height || 'auto'] || 'auto';
  const overlayOpacity = banner.overlayOpacity || 0;
  const textColor = banner.textColor || '#ffffff';
  const alignment = banner.alignment || 'center';
  const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justifyContent = alignMap[alignment] || 'center';

  const optimizedDesktop = optimizeImageUrl(imageDesktop, 1920, 85);
  const optimizedMobile = optimizeImageUrl(imageMobile || imageDesktop, 768, 80);

  const preloadTag = optimizedDesktop 
    ? `<link rel="preload" as="image" href="${escapeHtml(optimizedDesktop)}" fetchpriority="high">`
    : '';

  const overlayHtml = overlayOpacity > 0
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${overlayOpacity / 100});"></div>`
    : '';

  const textHtml = (title || subtitle || buttonText) ? `
    <div style="position:relative;z-index:2;text-align:${alignment};display:flex;flex-direction:column;align-items:${justifyContent};gap:12px;padding:24px;max-width:800px;">
      ${title ? `<h1 style="font-size:clamp(24px,5vw,48px);font-weight:700;color:${textColor};font-family:var(--sf-heading-font);line-height:1.2;">${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<p style="font-size:clamp(14px,2.5vw,20px);color:${textColor};opacity:0.9;">${escapeHtml(subtitle)}</p>` : ''}
      ${buttonText ? `<a href="${escapeHtml(buttonUrl || linkUrl || '#')}" style="display:inline-block;margin-top:8px;padding:12px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border-radius:6px;font-weight:600;font-size:16px;">${escapeHtml(buttonText)}</a>` : ''}
    </div>` : '';

  const wrapperTag = linkUrl && !buttonText ? 'a' : 'div';
  const wrapperHref = linkUrl && !buttonText ? ` href="${escapeHtml(linkUrl)}"` : '';

  return `
    ${preloadTag}
    <${wrapperTag}${wrapperHref} style="position:relative;width:100%;${height !== 'auto' ? `height:${height};` : ''}overflow:hidden;display:flex;align-items:center;justify-content:${justifyContent};background:#f5f5f5;">
      ${optimizedDesktop ? `
        <picture>
          ${optimizedMobile !== optimizedDesktop ? `<source srcset="${escapeHtml(optimizedMobile)}" media="(max-width:768px)">` : ''}
          <img src="${escapeHtml(optimizedDesktop)}" alt="${escapeHtml(title || 'Banner')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="eager" fetchpriority="high">
        </picture>
      ` : ''}
      ${overlayHtml}
      ${textHtml}
    </${wrapperTag}>`;
}

// ============================================
// PRODUCT PAGE RENDERER
// ============================================
function renderProductPage(product: any, images: any[], storeSettings: any, hostname: string): string {
  const mainImage = images.find((i: any) => i.is_primary) || images[0];
  const otherImages = images.filter((i: any) => i !== mainImage).slice(0, 4);
  
  const optimizedMain = optimizeImageUrl(mainImage?.url, 800, 85);
  const preloadTag = optimizedMain ? `<link rel="preload" as="image" href="${escapeHtml(optimizedMain)}" fetchpriority="high">` : '';
  
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount 
    ? Math.round((1 - product.price / product.compare_at_price) * 100) 
    : 0;

  // Thumbnail strip
  const thumbsHtml = otherImages.map((img: any) => {
    const thumb = optimizeImageUrl(img.url, 120, 75);
    return `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(img.alt_text || product.name)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #eee;cursor:pointer;" loading="lazy">`;
  }).join('');

  // JSON-LD for SEO
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.short_description || product.description || '',
    "image": images.map((i: any) => i.url).filter(Boolean),
    "sku": product.sku || '',
    "brand": product.brand ? { "@type": "Brand", "name": product.brand } : undefined,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "BRL",
      "price": product.price.toFixed(2),
      "availability": product.stock_quantity > 0 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "url": `https://${hostname}/produto/${product.slug}`,
    }
  });

  return `
    ${preloadTag}
    <script type="application/ld+json">${jsonLd}</script>
    <div style="max-width:1280px;margin:0 auto;padding:24px 16px;">
      <div style="display:grid;grid-template-columns:1fr;gap:32px;">
        <!-- Mobile: stack, Desktop: side by side -->
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
              ${hasDiscount ? `<span style="font-size:14px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(product.compare_at_price)}</span>` : ''}
              <span style="font-size:28px;font-weight:700;color:var(--theme-text-primary,#1a1a1a);">${formatPriceFromDecimal(product.price)}</span>
              ${hasDiscount ? `<span style="font-size:13px;font-weight:600;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:4px;">-${discountPercent}%</span>` : ''}
            </div>
            <p style="font-size:13px;color:#666;">em até 12x de ${formatPriceFromDecimal(product.price / 12)} sem juros</p>
            ${product.short_description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#555);line-height:1.6;">${escapeHtml(product.short_description)}</p>` : ''}
            ${product.stock_quantity > 0 
              ? `<button style="margin-top:8px;padding:14px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%;max-width:400px;">Adicionar ao carrinho</button>` 
              : `<p style="margin-top:8px;padding:14px;background:#fef2f2;color:#dc2626;border-radius:8px;text-align:center;font-weight:500;">Produto indisponível</p>`
            }
            ${product.free_shipping ? `<p style="font-size:13px;color:#16a34a;font-weight:500;margin-top:4px;">🚚 Frete grátis</p>` : ''}
          </div>
        </div>
      </div>
      ${product.description ? `
        <div style="margin-top:48px;border-top:1px solid #eee;padding-top:32px;">
          <h2 style="font-size:20px;font-weight:600;font-family:var(--sf-heading-font);margin-bottom:16px;">Descrição</h2>
          <div style="font-size:15px;line-height:1.8;color:var(--theme-text-secondary,#444);">${product.description}</div>
        </div>
      ` : ''}
    </div>`;
}

// ============================================
// CATEGORY PAGE RENDERER
// ============================================
function renderCategoryPage(category: any, products: any[], hostname: string): string {
  const bannerUrl = category.banner_desktop_url;
  const categoryBanner = bannerUrl 
    ? `<div style="position:relative;width:100%;height:200px;overflow:hidden;background:#f5f5f5;">
        <img src="${escapeHtml(optimizeImageUrl(bannerUrl, 1920, 80))}" alt="${escapeHtml(category.name)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="eager">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <h1 style="font-size:clamp(24px,4vw,40px);font-weight:700;color:#fff;font-family:var(--sf-heading-font);">${escapeHtml(category.name)}</h1>
        </div>
      </div>`
    : `<div style="padding:32px 16px;text-align:center;">
        <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);">${escapeHtml(category.name)}</h1>
        ${category.description ? `<p style="font-size:15px;color:var(--theme-text-secondary,#666);margin-top:8px;max-width:600px;margin-left:auto;margin-right:auto;">${escapeHtml(category.description)}</p>` : ''}
      </div>`;

  const productsGrid = products.map((p: any) => {
    const imgUrl = p.product_images?.[0]?.url;
    const optimized = optimizeImageUrl(imgUrl, 400, 80);
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.price;
    const discountPercent = hasDiscount ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;

    return `
      <a href="/produto/${escapeHtml(p.slug)}" style="display:block;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;transition:box-shadow .2s;">
        <div style="aspect-ratio:1;background:#f9f9f9;overflow:hidden;">
          ${optimized ? `<img src="${escapeHtml(optimized)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
        </div>
        <div style="padding:12px;">
          <p style="font-size:14px;font-weight:500;line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.name)}</p>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            ${hasDiscount ? `<span style="font-size:12px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(p.compare_at_price)}</span>` : ''}
            <span style="font-size:16px;font-weight:700;">${formatPriceFromDecimal(p.price)}</span>
            ${hasDiscount ? `<span style="font-size:11px;font-weight:600;color:#16a34a;background:#dcfce7;padding:1px 6px;border-radius:3px;">-${discountPercent}%</span>` : ''}
          </div>
        </div>
      </a>`;
  }).join('');

  // JSON-LD for category
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

// ============================================
// FOOTER RENDERER (simple)
// ============================================
function renderFooter(storeSettings: any, tenant: any): string {
  const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
  const year = new Date().getFullYear();
  
  return `
    <footer style="background:#f9f9f9;border-top:1px solid #eee;padding:32px 16px;margin-top:48px;">
      <div style="max-width:1280px;margin:0 auto;text-align:center;">
        <p style="font-size:13px;color:#999;">© ${year} ${escapeHtml(storeName)}. Todos os direitos reservados.</p>
      </div>
    </footer>`;
}

// ============================================
// PAGE SHELL — wraps all pages
// ============================================
function buildFullPage(opts: {
  title: string;
  description: string;
  canonicalUrl: string;
  faviconUrl: string;
  ogImage: string;
  googleFontsLink: string;
  themeCss: string;
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
  tenantSlug: string;
  tenantId: string;
  hostname: string;
  resolveMs: number;
  queryMs: number;
  totalMs: number;
  extraHead?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}">
  <link rel="canonical" href="${escapeHtml(opts.canonicalUrl)}">
  ${opts.faviconUrl ? `<link rel="icon" href="${escapeHtml(optimizeImageUrl(opts.faviconUrl, 32, 90))}" type="image/x-icon">` : ''}
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(opts.title)}">
  <meta property="og:description" content="${escapeHtml(opts.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(opts.canonicalUrl)}">
  ${opts.ogImage ? `<meta property="og:image" content="${escapeHtml(opts.ogImage)}">` : ''}
  
  ${opts.googleFontsLink}
  <style>${opts.themeCss}</style>
  ${opts.extraHead || ''}
</head>
<body>
  ${opts.headerHtml}
  <main>
    ${opts.bodyHtml}
    <div id="sf-hydrate-root" data-tenant="${escapeHtml(opts.tenantSlug)}" data-hostname="${escapeHtml(opts.hostname)}"></div>
  </main>
  ${opts.footerHtml}
  <script>
    window.__SF_SERVER_RENDERED = true;
    window.__SF_TIMING = { resolve: ${opts.resolveMs}, queries: ${opts.queryMs}, total: ${opts.totalMs} };
    window.__SF_TENANT = { slug: "${escapeHtml(opts.tenantSlug)}", id: "${escapeHtml(opts.tenantId)}" };
  </script>
</body>
</html>`;
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  console.log(`[storefront-html][${VERSION}] Request received — ${req.method} ${req.url}`);
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    let hostname = url.searchParams.get('hostname') || '';
    let path = url.searchParams.get('path') || '/';
    
    if (!hostname) {
      const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      if (forwardedHost && !forwardedHost.includes('supabase.co') && !forwardedHost.includes('functions.supabase.co')) {
        hostname = forwardedHost;
      }
    }

    if (!hostname && req.method === 'POST') {
      try {
        const body = await req.json();
        hostname = body.hostname || '';
        path = body.path || path;
      } catch { /* ignore */ }
    }

    if (!hostname) {
      return new Response(
        JSON.stringify({ error: 'hostname required', usage: '?hostname=example.com&path=/produto/my-slug' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    hostname = hostname.toLowerCase().trim();
    const route = parseRoute(path);
    console.log(`[storefront-html] Resolving: ${hostname}, route: ${route.type}${route.slug ? '/' + route.slug : ''}`);

    // === STEP 1: Resolve tenant ===
    const resolveStart = Date.now();
    const resolveResult = await resolveTenantFromHostname(supabase, hostname);
    const resolveMs = Date.now() - resolveStart;

    if (!resolveResult.found) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Loja não encontrada</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Loja não encontrada</h1></body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const tenantId = resolveResult.tenant_id;
    const tenantSlug = resolveResult.tenant_slug;

    // === STEP 2: Run base queries in parallel (always needed) ===
    const queryStart = Date.now();
    
    // Base queries (all pages need these)
    const baseQueries = [
      supabase.from('tenants').select('id, name, slug, logo_url').eq('id', tenantId).maybeSingle(),
      supabase.from('store_settings').select('store_name, logo_url, store_description, social_instagram, social_facebook, social_whatsapp, contact_phone, contact_email, is_published, favicon_url, seo_title, seo_description').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('menus').select('*, menu_items(*)').eq('tenant_id', tenantId).eq('location', 'header').maybeSingle(),
      supabase.from('categories').select('id, name, slug').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order').limit(10),
      supabase.from('storefront_template_sets').select('id, published_content, is_published, base_preset').eq('tenant_id', tenantId).eq('is_published', true).maybeSingle(),
    ];

    // Route-specific queries
    const routeQueries: Promise<any>[] = [];
    if (route.type === 'product' && route.slug) {
      routeQueries.push(
        supabase.from('products')
          .select('id, name, slug, sku, price, compare_at_price, description, short_description, brand, stock_quantity, status, free_shipping, seo_title, seo_description, has_variants, tags')
          .eq('tenant_id', tenantId)
          .eq('slug', route.slug)
          .is('deleted_at', null)
          .maybeSingle()
      );
    } else if (route.type === 'category' && route.slug) {
      routeQueries.push(
        supabase.from('categories')
          .select('id, name, slug, description, image_url, banner_desktop_url, banner_mobile_url, seo_title, seo_description')
          .eq('tenant_id', tenantId)
          .eq('slug', route.slug)
          .eq('is_active', true)
          .maybeSingle()
      );
    }

    const allResults = await Promise.allSettled([...baseQueries, ...routeQueries]);
    const queryMs = Date.now() - queryStart;

    // Extract base results
    const tenant = allResults[0].status === 'fulfilled' ? (allResults[0] as any).value.data : null;
    const storeSettings = allResults[1].status === 'fulfilled' ? (allResults[1] as any).value.data : null;
    const headerMenuRaw = allResults[2].status === 'fulfilled' ? (allResults[2] as any).value.data : null;
    const categories = allResults[3].status === 'fulfilled' ? (allResults[3] as any).value.data : [];
    const templateSet = allResults[4].status === 'fulfilled' ? (allResults[4] as any).value.data : null;

    if (!storeSettings?.is_published) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Loja em construção</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;text-align:center;"><div><h1>Loja em construção</h1><p style="color:#666;">Esta loja ainda não está disponível para o público.</p></div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }
      );
    }

    // Common data
    const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
    const faviconUrl = storeSettings?.favicon_url || '';
    const publishedContent = templateSet?.published_content as Record<string, any> | null;
    const themeSettings = publishedContent?.themeSettings || null;
    const themeCss = generateThemeCss(themeSettings);
    const googleFontsLink = getGoogleFontsLink(themeSettings);
    const menuItems = headerMenuRaw?.menu_items 
      ? [...headerMenuRaw.menu_items].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : [];
    const headerHtml = renderHeader(storeSettings, tenant, menuItems, categories || [], tenantSlug);
    const footerHtml = renderFooter(storeSettings, tenant);

    // === STEP 3: Route-specific rendering ===
    let bodyHtml = '';
    let pageTitle = storeSettings?.seo_title || storeName;
    let pageDescription = storeSettings?.seo_description || storeSettings?.store_description || '';
    let canonicalPath = '/';
    let ogImage = storeSettings?.logo_url || tenant?.logo_url || '';
    let extraHead = '';

    if (route.type === 'home') {
      // HOME — banner from template
      const homeContent = publishedContent?.home || null;
      const banner = findFirstBanner(homeContent);
      bodyHtml = banner ? renderBanner(banner) : '';

    } else if (route.type === 'product' && route.slug) {
      // PRODUCT
      const productResult = allResults[5];
      const product = productResult?.status === 'fulfilled' ? (productResult as any).value.data : null;

      if (!product || product.status !== 'active') {
        return new Response(
          `<!DOCTYPE html><html><head><title>Produto não encontrado</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Produto não encontrado</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // Fetch images (separate query since we need product.id)
      const { data: images } = await supabase
        .from('product_images')
        .select('id, url, alt_text, is_primary, sort_order')
        .eq('product_id', product.id)
        .order('sort_order');

      bodyHtml = renderProductPage(product, images || [], storeSettings, hostname);
      pageTitle = product.seo_title || `${product.name} | ${storeName}`;
      pageDescription = product.seo_description || product.short_description || '';
      canonicalPath = `/produto/${product.slug}`;
      ogImage = images?.[0]?.url || ogImage;

    } else if (route.type === 'category' && route.slug) {
      // CATEGORY
      const categoryResult = allResults[5];
      const category = categoryResult?.status === 'fulfilled' ? (categoryResult as any).value.data : null;

      if (!category) {
        return new Response(
          `<!DOCTYPE html><html><head><title>Categoria não encontrada</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Categoria não encontrada</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // Fetch products for this category (via junction table)
      const { data: categoryProducts } = await supabase
        .from('product_categories')
        .select(`
          products!inner(id, name, slug, price, compare_at_price, stock_quantity, status, free_shipping,
            product_images(url, is_primary, sort_order)
          )
        `)
        .eq('category_id', category.id)
        .eq('products.tenant_id', tenantId)
        .eq('products.status', 'active')
        .is('products.deleted_at', null)
        .limit(48);

      const flatProducts = (categoryProducts || [])
        .map((pc: any) => pc.products)
        .filter(Boolean)
        .map((p: any) => ({
          ...p,
          product_images: (p.product_images || []).sort((a: any, b: any) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
          }),
        }));

      bodyHtml = renderCategoryPage(category, flatProducts, hostname);
      pageTitle = category.seo_title || `${category.name} | ${storeName}`;
      pageDescription = category.seo_description || category.description || '';
      canonicalPath = `/categoria/${category.slug}`;
      ogImage = category.banner_desktop_url || category.image_url || ogImage;

    } else {
      // Unknown route — return minimal page, let client-side handle
      bodyHtml = `<div style="min-height:50vh;display:flex;align-items:center;justify-content:center;"><p style="color:#999;">Carregando...</p></div>`;
    }

    const totalMs = Date.now() - startTime;
    const canonicalUrl = `https://${hostname}${canonicalPath}`;

    const html = buildFullPage({
      title: pageTitle,
      description: pageDescription,
      canonicalUrl,
      faviconUrl,
      ogImage,
      googleFontsLink,
      themeCss,
      headerHtml,
      bodyHtml,
      footerHtml,
      tenantSlug,
      tenantId,
      hostname,
      resolveMs,
      queryMs,
      totalMs,
      extraHead,
    });

    console.log(`[storefront-html] ${route.type}${route.slug ? '/' + route.slug : ''} rendered in ${totalMs}ms (resolve=${resolveMs}ms, queries=${queryMs}ms)`);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300, max-age=60',
        'Server-Timing': `resolve;dur=${resolveMs}, queries;dur=${queryMs}, total;dur=${totalMs}`,
        'X-Storefront-Version': VERSION,
        'X-Tenant': tenantSlug,
        'X-Route': `${route.type}${route.slug ? '/' + route.slug : ''}`,
      },
    });

  } catch (error) {
    console.error('[storefront-html] Fatal error:', error);
    const totalMs = Date.now() - startTime;
    return new Response(
      `<!DOCTYPE html><html><head><title>Erro</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Erro ao carregar a loja</h1></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Server-Timing': `total;dur=${totalMs}` } }
    );
  }
});
