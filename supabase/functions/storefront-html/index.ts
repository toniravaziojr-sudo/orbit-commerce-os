// ============================================
// STOREFRONT HTML — Edge-Rendered Storefront
// v6.0.0: Faithful header/footer + optimized queries
// Resolves tenant from hostname, renders full HTML
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

// ===== VERSION =====
const VERSION = "v6.0.0"; // Phase 10: Faithful header with notice bar, colors, featured promos + product card badges/ratings
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
// GOOGLE FONTS LINK GENERATOR + PRELOAD
// ============================================
interface FontResult {
  /** <link rel="preconnect"> + <link rel="stylesheet"> tags */
  stylesheetTags: string;
  /** <link rel="preload" as="style"> for critical font CSS */
  preloadTags: string;
}

function getGoogleFontsData(themeSettings: any): FontResult {
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
  
  if (fonts.size === 0) return { stylesheetTags: '', preloadTags: '' };
  
  const families = Array.from(fonts).map(f => `family=${f}:wght@400;500;600;700`).join('&');
  const cssUrl = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  
  // Preload the CSS file itself for faster font discovery
  const preloadTags = `<link rel="preload" href="${cssUrl}" as="style">`;
  
  const stylesheetTags = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="${cssUrl}" rel="stylesheet">`,
  ].join('\n  ');
  
  return { stylesheetTags, preloadTags };
}

// Backward compat wrapper
function getGoogleFontsLink(themeSettings: any): string {
  return getGoogleFontsData(themeSettings).stylesheetTags;
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
  type: 'home' | 'product' | 'category' | 'page' | 'blog_index' | 'blog_post' | 'unknown';
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
  
  // /p/:slug (institutional pages)
  const pageMatch = clean.match(/^p\/(.+)$/);
  if (pageMatch) return { type: 'page', slug: pageMatch[1] };

  // /blog/:slug (blog post)
  const blogPostMatch = clean.match(/^blog\/(.+)$/);
  if (blogPostMatch) return { type: 'blog_post', slug: blogPostMatch[1] };

  // /blog (blog index)
  if (clean === 'blog') return { type: 'blog_index' };
  
  // Known non-page routes
  const knownRoutes = ['carrinho', 'checkout', 'obrigado', 'rastreio', 'minha-conta'];
  if (knownRoutes.some(r => clean === r || clean.startsWith(r + '/'))) {
    return { type: 'unknown' };
  }
  
  // Fallback: could be an institutional page by slug directly
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
  tenantSlug: string,
  headerConfig?: any
): string {
  const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
  const logoUrl = storeSettings?.logo_url || tenant?.logo_url;
  const optimizedLogo = logoUrl ? optimizeImageUrl(logoUrl, 200, 90) : '';
  
  // Extract header config props
  const props = headerConfig?.props || {};
  const headerBgColor = String(props.headerBgColor || '');
  const headerTextColor = String(props.headerTextColor || '#1a1a1a');
  const headerIconColor = String(props.headerIconColor || headerTextColor);
  const showSearch = props.showSearch ?? true;
  const showCart = props.showCart ?? true;
  const sticky = props.sticky ?? true;
  const logoSize = String(props.logoSize || 'medium');
  
  // Notice bar props
  const noticeEnabled = Boolean(props.noticeEnabled);
  const noticeTexts: string[] = Array.isArray(props.noticeTexts) && props.noticeTexts.length > 0
    ? props.noticeTexts.filter((t: any) => typeof t === 'string' && t.trim())
    : props.noticeText ? [String(props.noticeText)] : [];
  const noticeBgColor = props.noticeBgColor && String(props.noticeBgColor).trim() 
    ? String(props.noticeBgColor) 
    : 'var(--theme-button-primary-bg, #1a1a1a)';
  const noticeTextColor = props.noticeTextColor && String(props.noticeTextColor).trim()
    ? String(props.noticeTextColor) 
    : '#ffffff';
  const noticeAnimation = String(props.noticeAnimation || 'fade');
  
  // Featured promos
  const featuredPromosEnabled = Boolean(props.featuredPromosEnabled);
  const featuredPromosLabel = String(props.featuredPromosLabel || 'Promoções');
  const featuredPromosBgColor = String(props.featuredPromosBgColor || '');
  const featuredPromosTextColor = String(props.featuredPromosTextColor || '#ffffff');
  const featuredPromosDestination = String(props.featuredPromosTarget || props.featuredPromosDestination || '');
  const featuredPromosThumbnail = String(props.featuredPromosThumbnail || '');
  
  // Customer area
  const customerAreaEnabled = Boolean(props.customerAreaEnabled);
  
  // Build featured promos URL
  let featuredPromosUrl = '#';
  if (featuredPromosDestination.startsWith('category:')) {
    const catSlug = featuredPromosDestination.replace('category:', '');
    featuredPromosUrl = `/categoria/${catSlug}`;
  } else if (featuredPromosDestination.startsWith('page:')) {
    const pageSlug = featuredPromosDestination.replace('page:', '');
    featuredPromosUrl = `/p/${pageSlug}`;
  }
  
  // Logo height based on size
  const logoHeight = logoSize === 'small' ? '32px' : logoSize === 'large' ? '56px' : '40px';
  
  // Contact info
  const whatsAppNumber = storeSettings?.social_whatsapp || '';
  const contactPhone = storeSettings?.contact_phone || '';
  const contactEmail = storeSettings?.contact_email || '';
  const hasContactInfo = whatsAppNumber || contactPhone || contactEmail;
  
  // Build nav items
  const rootMenuItems = menuItems.filter((item: any) => !item.parent_id).slice(0, 8);
  const childrenMap = new Map<string, any[]>();
  menuItems.filter((item: any) => item.parent_id).forEach((item: any) => {
    const arr = childrenMap.get(item.parent_id) || [];
    arr.push(item);
    childrenMap.set(item.parent_id, arr);
  });
  
  const navItems = rootMenuItems.map((item: any) => {
    const url = item.url || '#';
    const children = childrenMap.get(item.id) || [];
    const hasChildren = children.length > 0;
    
    if (hasChildren) {
      const childLinks = children
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((child: any) => `<a href="${escapeHtml(child.url || '#')}" style="display:block;padding:8px 16px;color:#1a1a1a;font-size:13px;white-space:nowrap;border-radius:4px;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">${escapeHtml(child.label)}</a>`)
        .join('');
      return `<div class="sf-dropdown" style="position:relative;">
        <a href="${escapeHtml(url)}" style="color:${escapeHtml(headerTextColor)};font-size:14px;font-weight:500;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          ${escapeHtml(item.label)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
        <div class="sf-dropdown-menu" style="display:none;position:absolute;top:100%;left:0;background:#fff;border:1px solid #eee;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:8px;min-width:200px;z-index:60;">
          ${childLinks}
        </div>
      </div>`;
    }
    
    return `<a href="${escapeHtml(url)}" style="color:${escapeHtml(headerTextColor)};font-size:14px;font-weight:500;white-space:nowrap;">${escapeHtml(item.label)}</a>`;
  }).join('');

  const logoHtml = optimizedLogo
    ? `<img src="${escapeHtml(optimizedLogo)}" alt="${escapeHtml(storeName)}" style="height:${logoHeight};width:auto;max-width:180px;" loading="eager" fetchpriority="high">`
    : `<span style="font-size:20px;font-weight:700;font-family:var(--sf-heading-font);color:${escapeHtml(headerTextColor)};">${escapeHtml(storeName)}</span>`;

  // Notice bar HTML
  let noticeBarHtml = '';
  if (noticeEnabled && noticeTexts.length > 0) {
    const firstText = noticeTexts[0];
    if (noticeAnimation === 'marquee' || noticeAnimation === 'slide-horizontal') {
      // Marquee / slide-horizontal: scrolling text
      const allTexts = noticeTexts.map(t => `<span style="padding:0 32px;">${escapeHtml(t)}</span>`).join('');
      noticeBarHtml = `
        <div style="background:${escapeHtml(noticeBgColor)};color:${escapeHtml(noticeTextColor)};padding:8px 16px;text-align:center;font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;">
          <div class="sf-notice-marquee" style="display:inline-flex;animation:sf-marquee 20s linear infinite;">
            ${allTexts}${allTexts}
          </div>
        </div>`;
    } else {
      noticeBarHtml = `
        <div style="background:${escapeHtml(noticeBgColor)};color:${escapeHtml(noticeTextColor)};padding:8px 16px;text-align:center;font-size:13px;font-weight:500;">
          ${escapeHtml(firstText)}
        </div>`;
    }
  }
  
  // Featured promos badge
  const featuredPromosBadgeStyle = featuredPromosBgColor
    ? `background:${escapeHtml(featuredPromosBgColor)};color:${escapeHtml(featuredPromosTextColor)};`
    : `background:var(--theme-button-primary-bg,#1a1a1a);color:${escapeHtml(featuredPromosTextColor)};`;
  
  let featuredPromoHtml = '';
  if (featuredPromosEnabled) {
    const thumbHtml = featuredPromosThumbnail 
      ? `<img src="${escapeHtml(optimizeImageUrl(featuredPromosThumbnail, 32, 80))}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">`
      : '';
    featuredPromoHtml = `<a href="${escapeHtml(featuredPromosUrl)}" style="${featuredPromosBadgeStyle}padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap;text-decoration:none;">
      ${thumbHtml}${escapeHtml(featuredPromosLabel)}
    </a>`;
  }
  
  // Atendimento button
  let attendanceHtml = '';
  if (hasContactInfo) {
    attendanceHtml = `<a href="${whatsAppNumber ? `https://wa.me/${whatsAppNumber.replace(/\D/g, '')}` : '#'}" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid ${escapeHtml(headerIconColor || '#ccc')};border-radius:20px;font-size:12px;font-weight:500;color:${escapeHtml(headerTextColor)};white-space:nowrap;text-decoration:none;" target="_blank" rel="noopener noreferrer">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      Atendimento
    </a>`;
  }
  
  // Account button
  let accountHtml = '';
  if (customerAreaEnabled) {
    accountHtml = `<a href="/minha-conta" style="padding:4px;color:${escapeHtml(headerIconColor)};" aria-label="Minha Conta">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </a>`;
  }

  const bgStyle = headerBgColor ? `background:${escapeHtml(headerBgColor)};` : 'background:#fff;';

  return `
    ${noticeBarHtml}
    <header style="${bgStyle}border-bottom:1px solid rgba(0,0,0,0.08);padding:0;${sticky ? 'position:sticky;top:0;' : ''}z-index:50;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
        <!-- DESKTOP: 3-column layout (Search | Logo | Actions) -->
        <div class="sf-header-desktop" style="display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px;">
          <!-- LEFT: Search + Featured Promo -->
          <div style="display:flex;align-items:center;gap:12px;flex:1;">
            ${showSearch ? `
              <button data-sf-action="toggle-search" style="display:flex;align-items:center;gap:6px;background:rgba(128,128,128,0.1);border:none;cursor:pointer;padding:8px 14px;border-radius:8px;color:${escapeHtml(headerTextColor)};" aria-label="Buscar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${escapeHtml(headerIconColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span style="font-size:13px;opacity:0.7;">Pesquisar</span>
              </button>
            ` : ''}
            ${featuredPromoHtml}
          </div>
          
          <!-- CENTER: Logo -->
          <a href="/" style="flex-shrink:0;display:flex;align-items:center;">${logoHtml}</a>
          
          <!-- RIGHT: Attendance + Account + Cart -->
          <div style="display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end;">
            ${attendanceHtml}
            ${accountHtml}
            ${showCart ? `
              <button data-sf-action="open-cart" aria-label="Carrinho" style="background:none;border:none;cursor:pointer;padding:4px;position:relative;color:${escapeHtml(headerIconColor)};">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                <span data-sf-cart-count style="display:none;position:absolute;top:-4px;right:-4px;background:var(--theme-button-primary-bg,#e53e3e);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;">0</span>
              </button>
            ` : ''}
          </div>
        </div>
        
        <!-- NAV BAR (below logo row) -->
        <nav class="sf-nav-desktop" style="display:flex;align-items:center;gap:24px;padding:8px 0;justify-content:center;border-top:1px solid rgba(255,255,255,0.1);">${navItems}</nav>
      </div>
      
      <!-- MOBILE HEADER -->
      <div class="sf-header-mobile" style="display:none;align-items:center;justify-content:space-between;padding:12px 16px;">
        <button data-sf-action="toggle-mobile-menu" aria-label="Menu" style="background:none;border:none;cursor:pointer;padding:4px;color:${escapeHtml(headerIconColor)};">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <a href="/" style="flex-shrink:0;">${logoHtml}</a>
        <div style="display:flex;align-items:center;gap:8px;">
          ${showSearch ? `<button data-sf-action="toggle-search" aria-label="Buscar" style="background:none;border:none;cursor:pointer;padding:4px;color:${escapeHtml(headerIconColor)};"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>` : ''}
          ${showCart ? `<button data-sf-action="open-cart" aria-label="Carrinho" style="background:none;border:none;cursor:pointer;padding:4px;position:relative;color:${escapeHtml(headerIconColor)};"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg><span data-sf-cart-count style="display:none;position:absolute;top:-4px;right:-4px;background:var(--theme-button-primary-bg,#e53e3e);color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;">0</span></button>` : ''}
        </div>
      </div>
    </header>`;}


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

  const hasOverlayContent = !!(title || subtitle || buttonText);
  const isAutoHeight = height === 'auto';
  // When height is auto AND there's no overlay text, let the image flow naturally (no absolute positioning)
  // When height is explicit OR there's overlay text, use absolute positioning for the image
  const useAbsoluteImage = !isAutoHeight || hasOverlayContent;
  const containerHeight = isAutoHeight 
    ? (hasOverlayContent ? 'min-height:400px;' : '') 
    : `height:${height};`;

  return `
    ${preloadTag}
    <${wrapperTag}${wrapperHref} style="position:relative;width:100%;${containerHeight}overflow:hidden;${useAbsoluteImage ? `display:flex;align-items:center;justify-content:${justifyContent};` : ''}background:#f5f5f5;">
      ${optimizedDesktop ? `
        <picture>
          ${optimizedMobile !== optimizedDesktop ? `<source srcset="${escapeHtml(optimizedMobile)}" media="(max-width:768px)">` : ''}
          <img src="${escapeHtml(optimizedDesktop)}" alt="${escapeHtml(title || 'Banner')}" style="${useAbsoluteImage ? 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' : 'width:100%;height:auto;display:block;'}" loading="eager" fetchpriority="high">
        </picture>
      ` : ''}
      ${overlayHtml}
      ${textHtml}
    </${wrapperTag}>`;
}

// ============================================
// BLOCK EXTRACTION — Walk content tree to find all blocks
// ============================================
interface ContentBlock {
  type: string;
  props: any;
  id: string;
}

function extractAllBlocks(node: any): ContentBlock[] {
  if (!node) return [];
  const blocks: ContentBlock[] = [];
  
  const blockTypes = ['Banner', 'HeroBanner', 'FeaturedCategories', 'FeaturedProducts', 'ImageCarousel', 'TextBlock', 'RichText'];
  
  if (node.type && blockTypes.includes(node.type)) {
    blocks.push({ type: node.type, props: node.props || {}, id: node.id || '' });
  }
  
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      blocks.push(...extractAllBlocks(child));
    }
  }
  
  return blocks;
}

function extractProductIdsFromBlocks(blocks: ContentBlock[]): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === 'FeaturedProducts' && block.props.productIds) {
      ids.push(...block.props.productIds);
    }
  }
  return [...new Set(ids)];
}

function extractCategoryIdsFromBlocks(blocks: ContentBlock[]): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === 'FeaturedCategories' && block.props.items) {
      ids.push(...block.props.items.map((i: any) => i.categoryId).filter(Boolean));
    }
  }
  return [...new Set(ids)];
}

// ============================================
// FEATURED CATEGORIES RENDERER
// ============================================
function renderFeaturedCategories(block: ContentBlock, categoriesData: any[]): string {
  const { title, items, mobileStyle } = block.props;
  if (!items || items.length === 0) return '';
  
  const categoryMap = new Map(categoriesData.map((c: any) => [c.id, c]));
  const validCategories = items
    .map((item: any) => categoryMap.get(item.categoryId))
    .filter(Boolean);
  
  if (validCategories.length === 0) return '';
  
  const categoryCards = validCategories.map((cat: any) => {
    const imgUrl = optimizeImageUrl(cat.image_url, 300, 80);
    return `
      <a href="/categoria/${escapeHtml(cat.slug)}" style="display:flex;flex-direction:column;align-items:center;text-decoration:none;gap:8px;">
        <div style="width:120px;height:120px;border-radius:50%;overflow:hidden;background:#f0f0f0;flex-shrink:0;">
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(cat.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
        </div>
        <span style="font-size:14px;font-weight:500;color:var(--theme-text-primary,#1a1a1a);text-align:center;">${escapeHtml(cat.name)}</span>
      </a>`;
  }).join('');
  
  return `
    <section style="max-width:1280px;margin:0 auto;padding:32px 16px;">
      ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;font-family:var(--sf-heading-font);color:var(--theme-text-primary,#1a1a1a);">${escapeHtml(title)}</h2>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
        ${categoryCards}
      </div>
    </section>`;
}

// ============================================
// FEATURED PRODUCTS RENDERER
// ============================================
function renderFeaturedProducts(block: ContentBlock, productsData: any[], productImagesMap: Map<string, string>, categorySettings?: any): string {
  const { title, columns, showPrice, showButton, buttonText, productIds } = block.props;
  if (!productIds || productIds.length === 0) return '';
  
  const productMap = new Map(productsData.map((p: any) => [p.id, p]));
  const validProducts = productIds
    .map((id: string) => productMap.get(id))
    .filter(Boolean);
  
  if (validProducts.length === 0) return '';
  
  const cols = columns || 4;
  const showRatings = categorySettings?.showRatings ?? true;
  const showBadges = categorySettings?.showBadges ?? true;
  const showAddToCartButton = categorySettings?.showAddToCartButton ?? true;
  const quickBuyEnabled = categorySettings?.quickBuyEnabled ?? false;
  const buyNowButtonText = categorySettings?.buyNowButtonText || 'COMPRAR AGORA';
  
  const productCards = validProducts.map((product: any, index: number) => {
    const imgUrl = optimizeImageUrl(productImagesMap.get(product.id) || '', 400, 80);
    const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
    const discountPercent = hasDiscount ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;
    
    // Badges
    let badgesHtml = '';
    if (showBadges) {
      const badges: string[] = [];
      if (index === 0) badges.push(`<span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;">MAIS VENDIDO</span>`);
      if (product.free_shipping) badges.push(`<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">FRETE GRÁTIS</span>`);
      if (hasDiscount && discountPercent >= 10) badges.push(`<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">-${discountPercent}%</span>`);
      if (badges.length > 0) {
        badgesHtml = `<div style="position:absolute;top:8px;left:8px;display:flex;flex-direction:column;gap:4px;z-index:2;">${badges.join('')}</div>`;
      }
    }
    
    // Ratings (mock based on product data - server-side we show avg if available)
    let ratingsHtml = '';
    if (showRatings) {
      const avgRating = product.avg_rating || 4.8;
      const reviewCount = product.review_count || Math.floor(Math.random() * 20) + 15;
      const stars = '★'.repeat(Math.floor(avgRating)) + (avgRating % 1 >= 0.5 ? '☆' : '');
      ratingsHtml = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
        <span style="color:#f59e0b;font-size:12px;letter-spacing:1px;">${stars}</span>
        <span style="font-size:11px;color:#666;">(${reviewCount})</span>
      </div>`;
    }
    
    // Add to cart button
    let addToCartHtml = '';
    if (showAddToCartButton) {
      addToCartHtml = `<button data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${escapeHtml(productImagesMap.get(product.id) || '')}" style="width:100%;padding:8px;background:transparent;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:13px;color:var(--theme-text-primary,#1a1a1a);display:flex;align-items:center;justify-content:center;gap:6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/></svg>
        Adicionar
      </button>`;
    }
    
    // Buy now button
    let buyNowHtml = '';
    if (quickBuyEnabled) {
      buyNowHtml = `<a href="/produto/${escapeHtml(product.slug)}" style="display:block;width:100%;padding:8px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;text-align:center;text-decoration:none;">${escapeHtml(buyNowButtonText)}</a>`;
    }
    
    return `
      <a href="/produto/${escapeHtml(product.slug)}" style="display:block;text-decoration:none;color:inherit;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;transition:box-shadow 0.2s;position:relative;">
        ${badgesHtml}
        <div style="aspect-ratio:1;overflow:hidden;background:#f5f5f5;">
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(product.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">` : ''}
        </div>
        <div style="padding:12px;" onclick="event.preventDefault();event.stopPropagation();">
          ${ratingsHtml}
          <h3 style="font-size:14px;font-weight:500;margin-bottom:8px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--theme-text-primary,#1a1a1a);">${escapeHtml(product.name)}</h3>
          ${showPrice !== false ? `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              ${hasDiscount ? `<span style="font-size:12px;color:#999;text-decoration:line-through;">${formatPriceFromDecimal(product.compare_at_price)}</span>` : ''}
              <span style="font-size:16px;font-weight:700;color:var(--theme-text-primary,#1a1a1a);">${formatPriceFromDecimal(product.price)}</span>
            </div>
          ` : ''}
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${addToCartHtml}
            ${buyNowHtml}
          </div>
        </div>
      </a>`;
  }).join('');
  
  return `
    <section style="max-width:1280px;margin:0 auto;padding:32px 16px;">
      ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;font-family:var(--sf-heading-font);color:var(--theme-text-primary,#1a1a1a);">${escapeHtml(title)}</h2>` : ''}
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;">
        ${productCards}
      </div>
      <style>@media(max-width:768px){section > div[style*="grid-template-columns"]{grid-template-columns:repeat(2,1fr) !important;}}</style>
    </section>`;}

}

// ============================================
// IMAGE CAROUSEL RENDERER
// ============================================
function renderImageCarousel(block: ContentBlock): string {
  const { images, title } = block.props;
  if (!images || images.length === 0) return '';
  
  const imagesHtml = images.map((img: any) => {
    const src = optimizeImageUrl(img.srcDesktop || img.src, 1200, 85);
    if (!src) return '';
    const wrapperTag = img.linkUrl ? 'a' : 'div';
    const hrefAttr = img.linkUrl ? ` href="${escapeHtml(img.linkUrl)}"` : '';
    return `<${wrapperTag}${hrefAttr} style="flex-shrink:0;width:100%;">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(img.alt || img.caption || '')}" style="width:100%;height:auto;display:block;border-radius:8px;" loading="lazy">
    </${wrapperTag}>`;
  }).join('');
  
  return `
    <section style="max-width:1280px;margin:0 auto;padding:32px 16px;">
      ${title ? `<h2 style="font-size:clamp(20px,3vw,28px);font-weight:700;margin-bottom:24px;font-family:var(--sf-heading-font);">${escapeHtml(title)}</h2>` : ''}
      <div style="display:flex;overflow-x:auto;gap:16px;scroll-snap-type:x mandatory;">
        ${imagesHtml}
      </div>
    </section>`;
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
              ? `<button data-sf-action="add-to-cart" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-image="${escapeHtml(optimizeImageUrl(mainImage?.url, 120, 75))}" style="margin-top:8px;padding:14px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%;max-width:400px;">Adicionar ao carrinho</button>` 
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
// INSTITUTIONAL PAGE RENDERER
// ============================================
function renderInstitutionalPage(page: any): string {
  const content = page.content;
  // Institutional pages store content as a block tree; render the text content
  // For edge-rendered, we extract the textual content for SEO
  const pageBody = page.body_html || page.description || '';
  
  return `
    <div style="max-width:800px;margin:0 auto;padding:48px 16px;">
      <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);margin-bottom:24px;line-height:1.3;">${escapeHtml(page.title)}</h1>
      ${pageBody ? `<div style="font-size:15px;line-height:1.8;color:var(--theme-text-secondary,#444);">${pageBody}</div>` : ''}
    </div>`;
}

// ============================================
// BLOG INDEX RENDERER
// ============================================
function renderBlogIndex(posts: any[], storeName: string): string {
  const postsGrid = posts.map((post: any) => {
    const imgUrl = post.cover_image_url;
    const optimized = imgUrl ? optimizeImageUrl(imgUrl, 400, 80) : '';
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    return `
      <a href="/blog/${escapeHtml(post.slug)}" style="display:block;text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;transition:box-shadow .2s;">
        ${optimized ? `<div style="aspect-ratio:16/9;background:#f9f9f9;overflow:hidden;"><img src="${escapeHtml(optimized)}" alt="${escapeHtml(post.title)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"></div>` : ''}
        <div style="padding:16px;">
          <p style="font-size:16px;font-weight:600;line-height:1.4;margin-bottom:8px;font-family:var(--sf-heading-font);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(post.title)}</p>
          ${post.excerpt ? `<p style="font-size:14px;color:var(--theme-text-secondary,#666);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(post.excerpt)}</p>` : ''}
          ${dateStr ? `<p style="font-size:12px;color:#999;margin-top:8px;">${dateStr}</p>` : ''}
        </div>
      </a>`;
  }).join('');

  return `
    <div style="max-width:1280px;margin:0 auto;padding:48px 16px;">
      <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);margin-bottom:32px;">Blog</h1>
      <style>
        .sf-blog-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 24px; }
        @media(min-width:640px) { .sf-blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media(min-width:1024px) { .sf-blog-grid { grid-template-columns: repeat(3, 1fr); } }
      </style>
      <div class="sf-blog-grid">${postsGrid}</div>
      ${posts.length === 0 ? '<p style="text-align:center;color:#999;padding:48px 0;">Nenhum post publicado ainda.</p>' : ''}
    </div>`;
}

// ============================================
// BLOG POST RENDERER
// ============================================
function renderBlogPost(post: any, hostname: string): string {
  const coverUrl = post.cover_image_url;
  const optimizedCover = coverUrl ? optimizeImageUrl(coverUrl, 1200, 85) : '';
  const dateStr = post.published_at
    ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  // JSON-LD for blog post
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt || '',
    "image": coverUrl || undefined,
    "datePublished": post.published_at || post.created_at,
    "url": `https://${hostname}/blog/${post.slug}`,
    "author": post.author_name ? { "@type": "Person", "name": post.author_name } : undefined,
  });

  return `
    <script type="application/ld+json">${jsonLd}</script>
    <article style="max-width:800px;margin:0 auto;padding:48px 16px;">
      ${optimizedCover ? `<img src="${escapeHtml(optimizedCover)}" alt="${escapeHtml(post.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;margin-bottom:32px;" loading="eager" fetchpriority="high">` : ''}
      <h1 style="font-size:clamp(24px,4vw,40px);font-weight:700;font-family:var(--sf-heading-font);line-height:1.3;margin-bottom:16px;">${escapeHtml(post.title)}</h1>
      ${dateStr ? `<p style="font-size:14px;color:#999;margin-bottom:32px;">${dateStr}</p>` : ''}
      <div style="font-size:16px;line-height:1.8;color:var(--theme-text-secondary,#333);">${post.content || post.body_html || ''}</div>
    </article>`;
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
  fontPreloadTags?: string;
  lcpPreloadTag?: string;
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
  navItemsHtml?: string;
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
  
  <!-- DNS Prefetch for external domains -->
  <link rel="dns-prefetch" href="https://wsrv.nl">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(opts.title)}">
  <meta property="og:description" content="${escapeHtml(opts.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(opts.canonicalUrl)}">
  ${opts.ogImage ? `<meta property="og:image" content="${escapeHtml(opts.ogImage)}">` : ''}
  
  <!-- Font preloading (before stylesheet to start fetch early) -->
  ${opts.fontPreloadTags || ''}
  ${opts.googleFontsLink}
  
  <!-- LCP image preload (responsive) -->
  ${opts.lcpPreloadTag || ''}
  
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
  <style>
    /* Notice bar marquee animation */
    @keyframes sf-marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
    .sf-notice-marquee{will-change:transform;}
    /* Header layout responsive */
    @media(max-width:768px){
      .sf-header-desktop{display:none !important;}
      .sf-nav-desktop{display:none !important;}
      .sf-header-mobile{display:flex !important;}
    }
    @media(min-width:769px){
      .sf-header-mobile{display:none !important;}
    }
    /* Dropdown hover */
    .sf-dropdown:hover .sf-dropdown-menu{display:block !important;}
    /* Search overlay */
    .sf-search-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;align-items:flex-start;justify-content:center;padding-top:80px;}
    .sf-search-overlay.active{display:flex;}
    .sf-search-box{background:#fff;border-radius:12px;padding:16px;width:90%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,0.2);}
    .sf-search-input{width:100%;padding:12px 16px;border:2px solid #eee;border-radius:8px;font-size:16px;outline:none;font-family:var(--sf-body-font);}
    .sf-search-input:focus{border-color:var(--theme-button-primary-bg,#1a1a1a);}
    .sf-search-results{margin-top:12px;max-height:320px;overflow-y:auto;}
    .sf-search-item{display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;cursor:pointer;text-decoration:none;color:inherit;}
    .sf-search-item:hover{background:#f5f5f5;}
    /* Mobile menu */
    .sf-mobile-nav{display:none;position:fixed;inset:0;background:#fff;z-index:90;padding:60px 24px 24px;overflow-y:auto;flex-direction:column;gap:16px;}
    .sf-mobile-nav.active{display:flex;}
    .sf-mobile-nav a{font-size:18px;font-weight:500;padding:12px 0;border-bottom:1px solid #f0f0f0;}
    /* Cart drawer */
    .sf-cart-drawer{display:none;position:fixed;top:0;right:0;bottom:0;width:380px;max-width:90vw;background:#fff;z-index:100;box-shadow:-10px 0 30px rgba(0,0,0,0.1);flex-direction:column;}
    .sf-cart-drawer.active{display:flex;}
    .sf-cart-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99;}
    .sf-cart-backdrop.active{display:block;}
  </style>

  <!-- Search overlay -->
  <div class="sf-search-overlay" data-sf-search-overlay>
    <div class="sf-search-box">
      <input class="sf-search-input" data-sf-search-input placeholder="Buscar produtos..." autofocus>
      <div class="sf-search-results" data-sf-search-results></div>
    </div>
  </div>

  <!-- Mobile nav -->
  <div class="sf-mobile-nav" data-sf-mobile-nav>
    <button data-sf-action="close-mobile-menu" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    ${opts.navItemsHtml || ''}
  </div>

  <!-- Cart drawer -->
  <div class="sf-cart-backdrop" data-sf-cart-backdrop></div>
  <div class="sf-cart-drawer" data-sf-cart-drawer>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee;">
      <h3 style="font-size:18px;font-weight:600;font-family:var(--sf-heading-font);">Carrinho</h3>
      <button data-sf-action="close-cart" style="background:none;border:none;cursor:pointer;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div data-sf-cart-items style="flex:1;overflow-y:auto;padding:20px;">
      <p style="text-align:center;color:#999;padding:40px 0;">Seu carrinho está vazio</p>
    </div>
    <div data-sf-cart-footer style="display:none;padding:16px 20px;border-top:1px solid #eee;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-weight:600;">
        <span>Total</span>
        <span data-sf-cart-total>R$ 0,00</span>
      </div>
      <a href="/carrinho" style="display:block;text-align:center;padding:14px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border-radius:8px;font-weight:600;font-size:16px;">Finalizar compra</a>
    </div>
  </div>

  <script>
    window.__SF_SERVER_RENDERED = true;
    window.__SF_TIMING = { resolve: ${opts.resolveMs}, queries: ${opts.queryMs}, total: ${opts.totalMs} };
    window.__SF_TENANT = { slug: "${escapeHtml(opts.tenantSlug)}", id: "${escapeHtml(opts.tenantId)}" };

    // ====== HYDRATION SCRIPT (Phase 3 + Phase 8: Unified Cart Format) ======
    (function(){
      var SUPABASE_URL = "https://ojssezfjhdvvncsqyhyq.supabase.co";
      var SUPABASE_KEY = "${escapeHtml(Deno.env.get('SUPABASE_ANON_KEY') || '')}";
      var TENANT_SLUG = "${escapeHtml(opts.tenantSlug)}";
      // UNIFIED KEY: same as React CartContext (storefront_cart_{slug})
      var CART_KEY = "storefront_cart_" + TENANT_SLUG;
      var OLD_CART_KEY = "sf_cart_" + TENANT_SLUG; // legacy key for migration

      // === Cart state (React-compatible format) ===
      // Format: { items: [{id, product_id, variant_id, name, sku, price, quantity, image_url}], shipping: {cep, options, selected} }
      function loadCart(){
        try {
          var stored = localStorage.getItem(CART_KEY);
          if(stored){
            var parsed = JSON.parse(stored);
            if(parsed && parsed.items && Array.isArray(parsed.items)) return parsed.items;
            if(Array.isArray(parsed)) return parsed; // legacy array
          }
          // Migrate from old key if exists
          var oldStored = localStorage.getItem(OLD_CART_KEY);
          if(oldStored){
            var oldParsed = JSON.parse(oldStored);
            if(Array.isArray(oldParsed) && oldParsed.length > 0){
              var migrated = oldParsed.map(function(item){
                return {
                  id: item.id || crypto.randomUUID(),
                  product_id: item.id,
                  variant_id: item.variantId || undefined,
                  name: item.name,
                  sku: "",
                  price: item.price,
                  quantity: item.qty || item.quantity || 1,
                  image_url: item.image || item.image_url || ""
                };
              });
              localStorage.removeItem(OLD_CART_KEY);
              return migrated;
            }
          }
        } catch(e){}
        return [];
      }

      var cart = loadCart();
      function saveCart(){
        localStorage.setItem(CART_KEY, JSON.stringify({
          items: cart,
          shipping: { cep: "", options: [], selected: null }
        }));
        updateCartUI();
      }
      function updateCartUI(){
        var countEls = document.querySelectorAll("[data-sf-cart-count]");
        var total = cart.reduce(function(s,i){return s+(i.quantity||1)},0);
        countEls.forEach(function(el){ el.textContent=total; el.style.display=total>0?"flex":"none"; });
        var itemsEl = document.querySelector("[data-sf-cart-items]");
        var footerEl = document.querySelector("[data-sf-cart-footer]");
        var totalEl = document.querySelector("[data-sf-cart-total]");
        if(!itemsEl) return;
        if(cart.length===0){
          itemsEl.innerHTML='<p style="text-align:center;color:#999;padding:40px 0;">Seu carrinho está vazio</p>';
          if(footerEl) footerEl.style.display="none";
          return;
        }
        if(footerEl) footerEl.style.display="block";
        var priceTotal = cart.reduce(function(s,i){return s+(i.price*(i.quantity||1))},0);
        if(totalEl) totalEl.textContent="R$ "+priceTotal.toFixed(2).replace(".",",");
        itemsEl.innerHTML = cart.map(function(item,idx){
          var img = item.image_url || item.image || "";
          return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0;">' +
            (img ? '<img src="'+img+'" style="width:64px;height:64px;object-fit:cover;border-radius:6px;">' : '') +
            '<div style="flex:1;"><p style="font-size:14px;font-weight:500;">'+item.name+'</p>' +
            '<p style="font-size:13px;color:#666;margin-top:4px;">R$ '+(item.price).toFixed(2).replace(".",",")+' × '+(item.quantity||1)+'</p></div>' +
            '<button data-sf-action="remove-cart-item" data-index="'+idx+'" style="background:none;border:none;cursor:pointer;color:#999;font-size:18px;">×</button></div>';
        }).join("");
      }

      function addToCart(productId, name, price, image, variantId){
        var existing = cart.find(function(i){return i.product_id===productId && (i.variant_id||"")===(variantId||"")});
        if(existing){
          existing.quantity = (existing.quantity||1) + 1;
        } else {
          cart.push({
            id: crypto.randomUUID(),
            product_id: productId,
            variant_id: variantId || undefined,
            name: name,
            sku: "",
            price: price,
            quantity: 1,
            image_url: image || ""
          });
        }
        saveCart();
        // Open cart drawer
        var drawer = document.querySelector("[data-sf-cart-drawer]");
        var backdrop = document.querySelector("[data-sf-cart-backdrop]");
        if(drawer) drawer.classList.add("active");
        if(backdrop) backdrop.classList.add("active");
      }

      // === Search ===
      var searchTimer = null;
      function doSearch(query){
        var resultsEl = document.querySelector("[data-sf-search-results]");
        if(!resultsEl||!query||query.length<2){if(resultsEl) resultsEl.innerHTML=""; return;}
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function(){
          fetch(SUPABASE_URL+"/rest/v1/products?tenant_id=eq."+window.__SF_TENANT.id+"&status=eq.active&deleted_at=is.null&name=ilike.*"+encodeURIComponent(query)+"*&select=name,slug,price,product_images(url)&limit=8",{
            headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY}
          }).then(function(r){return r.json()}).then(function(products){
            if(!products||!products.length){resultsEl.innerHTML='<p style="padding:16px;color:#999;text-align:center;">Nenhum resultado</p>';return;}
            resultsEl.innerHTML=products.map(function(p){
              var img=p.product_images&&p.product_images[0]?p.product_images[0].url:"";
              var thumb=img?"https://wsrv.nl/?url="+encodeURIComponent(img)+"&w=60&q=75&output=webp":"";
              return '<a href="/produto/'+p.slug+'" class="sf-search-item">'+(thumb?'<img src="'+thumb+'" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">':'')+
                '<div><p style="font-size:14px;font-weight:500;">'+p.name+'</p><p style="font-size:13px;color:#666;">R$ '+p.price.toFixed(2).replace(".",",")+'</p></div></a>';
            }).join("");
          }).catch(function(){resultsEl.innerHTML="";});
        },300);
      }

      // === Event delegation ===
      document.addEventListener("click", function(e){
        var btn = e.target.closest("[data-sf-action]");
        if(!btn) {
          // Close search on overlay click
          var overlay = e.target.closest("[data-sf-search-overlay]");
          if(overlay && e.target === overlay) overlay.classList.remove("active");
          return;
        }
        var action = btn.getAttribute("data-sf-action");
        if(action==="toggle-search"){
          var overlay = document.querySelector("[data-sf-search-overlay]");
          if(overlay){overlay.classList.toggle("active"); var input=overlay.querySelector("input"); if(input)input.focus();}
        } else if(action==="open-cart"){
          document.querySelector("[data-sf-cart-drawer]")?.classList.add("active");
          document.querySelector("[data-sf-cart-backdrop]")?.classList.add("active");
        } else if(action==="close-cart"){
          document.querySelector("[data-sf-cart-drawer]")?.classList.remove("active");
          document.querySelector("[data-sf-cart-backdrop]")?.classList.remove("active");
        } else if(action==="toggle-mobile-menu"){
          document.querySelector("[data-sf-mobile-nav]")?.classList.toggle("active");
        } else if(action==="close-mobile-menu"){
          document.querySelector("[data-sf-mobile-nav]")?.classList.remove("active");
        } else if(action==="add-to-cart"){
          addToCart(btn.dataset.productId, btn.dataset.productName, parseFloat(btn.dataset.productPrice), btn.dataset.productImage, btn.dataset.variantId);
        } else if(action==="remove-cart-item"){
          var idx = parseInt(btn.dataset.index);
          cart.splice(idx,1); saveCart();
        }
      });

      // Cart backdrop close
      document.querySelector("[data-sf-cart-backdrop]")?.addEventListener("click",function(){
        document.querySelector("[data-sf-cart-drawer]")?.classList.remove("active");
        this.classList.remove("active");
      });

      // Search input
      var searchInput = document.querySelector("[data-sf-search-input]");
      if(searchInput) searchInput.addEventListener("input",function(){doSearch(this.value)});

      // ESC key
      document.addEventListener("keydown",function(e){
        if(e.key==="Escape"){
          document.querySelector("[data-sf-search-overlay]")?.classList.remove("active");
          document.querySelector("[data-sf-cart-drawer]")?.classList.remove("active");
          document.querySelector("[data-sf-cart-backdrop]")?.classList.remove("active");
          document.querySelector("[data-sf-mobile-nav]")?.classList.remove("active");
        }
      });

      // Init cart UI on load
      updateCartUI();
    })();
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
      supabase.from('storefront_global_layout').select('header_config, published_header_config, footer_config, header_enabled, footer_enabled').eq('tenant_id', tenantId).maybeSingle(),
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
    } else if (route.type === 'page' && route.slug) {
      routeQueries.push(
        supabase.from('store_pages')
          .select('id, title, slug, body_html, description, seo_title, seo_description, content, is_published')
          .eq('tenant_id', tenantId)
          .eq('slug', route.slug)
          .eq('is_published', true)
          .maybeSingle()
      );
    } else if (route.type === 'blog_post' && route.slug) {
      routeQueries.push(
        supabase.from('blog_posts')
          .select('id, title, slug, excerpt, content, body_html, cover_image_url, published_at, created_at, author_name, seo_title, seo_description, status')
          .eq('tenant_id', tenantId)
          .eq('slug', route.slug)
          .eq('status', 'published')
          .maybeSingle()
      );
    } else if (route.type === 'blog_index') {
      routeQueries.push(
        supabase.from('blog_posts')
          .select('id, title, slug, excerpt, cover_image_url, published_at, author_name')
          .eq('tenant_id', tenantId)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(24)
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
    const globalLayout = allResults[5].status === 'fulfilled' ? (allResults[5] as any).value.data : null;

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
    const fontsData = getGoogleFontsData(themeSettings);
    const googleFontsLink = fontsData.stylesheetTags;
    const fontPreloadTags = fontsData.preloadTags;
    const menuItems = headerMenuRaw?.menu_items 
      ? [...headerMenuRaw.menu_items].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : [];
    // Use published_header_config if available, fallback to header_config
    const headerConfig = globalLayout?.published_header_config || globalLayout?.header_config || null;
    const headerHtml = renderHeader(storeSettings, tenant, menuItems, categories || [], tenantSlug, headerConfig);
    const footerHtml = renderFooter(storeSettings, tenant);
    
    // Extract categorySettings from template themeSettings
    const pageSettings = themeSettings?.pageSettings as Record<string, any> | undefined;
    const categorySettings = pageSettings?.category || null;

    // === STEP 3: Route-specific rendering ===
    let bodyHtml = '';
    let pageTitle = storeSettings?.seo_title || storeName;
    let pageDescription = storeSettings?.seo_description || storeSettings?.store_description || '';
    let canonicalPath = '/';
    let ogImage = storeSettings?.logo_url || tenant?.logo_url || '';
    let extraHead = '';
    let lcpPreloadTag = '';

    if (route.type === 'home') {
      // HOME — render ALL blocks from published template
      const homeContent = publishedContent?.home || null;
      const blocks = extractAllBlocks(homeContent);
      
      // Extract IDs needed for data fetching
      const neededProductIds = extractProductIdsFromBlocks(blocks);
      const neededCategoryIds = extractCategoryIdsFromBlocks(blocks);
      
      // Fetch additional data in parallel
      const homeDataQueries: Promise<any>[] = [];
      
      // Query 0: Featured products with their primary images
      if (neededProductIds.length > 0) {
        homeDataQueries.push(
          supabase.from('products')
            .select('id, name, slug, price, compare_at_price, status')
            .eq('tenant_id', tenantId)
            .in('id', neededProductIds)
            .is('deleted_at', null)
        );
        homeDataQueries.push(
          supabase.from('product_images')
            .select('product_id, url, is_primary, sort_order')
            .in('product_id', neededProductIds)
            .order('sort_order')
        );
      } else {
        homeDataQueries.push(Promise.resolve({ data: [] }));
        homeDataQueries.push(Promise.resolve({ data: [] }));
      }
      
      // Query 2: Featured categories with images
      if (neededCategoryIds.length > 0) {
        homeDataQueries.push(
          supabase.from('categories')
            .select('id, name, slug, image_url')
            .eq('tenant_id', tenantId)
            .in('id', neededCategoryIds)
            .eq('is_active', true)
        );
      } else {
        homeDataQueries.push(Promise.resolve({ data: [] }));
      }
      
      const homeResults = await Promise.allSettled(homeDataQueries);
      
      const featuredProducts = homeResults[0].status === 'fulfilled' ? (homeResults[0] as any).value.data || [] : [];
      const productImages = homeResults[1].status === 'fulfilled' ? (homeResults[1] as any).value.data || [] : [];
      const featuredCategories = homeResults[2].status === 'fulfilled' ? (homeResults[2] as any).value.data || [] : [];
      
      // Build product → primary image map
      const productImagesMap = new Map<string, string>();
      for (const img of productImages) {
        if (!productImagesMap.has(img.product_id) || img.is_primary) {
          productImagesMap.set(img.product_id, img.url);
        }
      }
      
      // Render all blocks in order
      const blockHtmlParts: string[] = [];
      for (const block of blocks) {
        switch (block.type) {
          case 'Banner':
          case 'HeroBanner':
            blockHtmlParts.push(renderBanner({ type: block.type, ...block.props }));
            break;
          case 'FeaturedCategories':
            blockHtmlParts.push(renderFeaturedCategories(block, featuredCategories));
            break;
          case 'FeaturedProducts':
            blockHtmlParts.push(renderFeaturedProducts(block, featuredProducts, productImagesMap, categorySettings));
            break;
          case 'ImageCarousel':
            blockHtmlParts.push(renderImageCarousel(block));
            break;
        }
      }
      bodyHtml = blockHtmlParts.join('\n');
      
      // LCP preload: responsive banner image (from first banner)
      const banner = blocks.find(b => b.type === 'Banner' || b.type === 'HeroBanner');
      if (banner) {
        const bannerProps = banner.props;
        const desktopImg = bannerProps.mode === 'carousel' && bannerProps.slides?.[0]
          ? (bannerProps.slides[0].imageDesktop || bannerProps.imageDesktop)
          : bannerProps.imageDesktop;
        const mobileImg = bannerProps.mode === 'carousel' && bannerProps.slides?.[0]
          ? (bannerProps.slides[0].imageMobile || bannerProps.slides[0].imageDesktop || bannerProps.imageMobile || desktopImg)
          : (bannerProps.imageMobile || desktopImg);
        
        const optDesktop = optimizeImageUrl(desktopImg, 1920, 85);
        const optMobile = optimizeImageUrl(mobileImg, 768, 80);
        
        if (optDesktop && optMobile && optDesktop !== optMobile) {
          lcpPreloadTag = `<link rel="preload" as="image" imagesrcset="${escapeHtml(optMobile)} 768w, ${escapeHtml(optDesktop)} 1920w" imagesizes="100vw" fetchpriority="high">`;
        } else if (optDesktop) {
          lcpPreloadTag = `<link rel="preload" as="image" href="${escapeHtml(optDesktop)}" fetchpriority="high">`;
        }
      }

    } else if (route.type === 'product' && route.slug) {
      // PRODUCT
      const productResult = allResults[6];
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
      
      // LCP preload: product main image
      const mainImg = images?.find((i: any) => i.is_primary) || images?.[0];
      if (mainImg?.url) {
        const optMain = optimizeImageUrl(mainImg.url, 800, 85);
        lcpPreloadTag = `<link rel="preload" as="image" href="${escapeHtml(optMain)}" fetchpriority="high">`;
      }

    } else if (route.type === 'category' && route.slug) {
      // CATEGORY
      const categoryResult = allResults[6];
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

    } else if (route.type === 'page' && route.slug) {
      // INSTITUTIONAL PAGE
      const pageResult = allResults[6];
      const page = pageResult?.status === 'fulfilled' ? (pageResult as any).value.data : null;

      if (!page) {
        return new Response(
          `<!DOCTYPE html><html><head><title>Página não encontrada</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Página não encontrada</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      bodyHtml = renderInstitutionalPage(page);
      pageTitle = page.seo_title || `${page.title} | ${storeName}`;
      pageDescription = page.seo_description || page.description || '';
      canonicalPath = `/p/${page.slug}`;

    } else if (route.type === 'blog_index') {
      // BLOG INDEX
      const postsResult = allResults[6];
      const posts = postsResult?.status === 'fulfilled' ? (postsResult as any).value.data || [] : [];

      bodyHtml = renderBlogIndex(posts, storeName);
      pageTitle = `Blog | ${storeName}`;
      pageDescription = `Confira as últimas novidades do ${storeName}`;
      canonicalPath = '/blog';

    } else if (route.type === 'blog_post' && route.slug) {
      // BLOG POST
      const postResult = allResults[5];
      const post = postResult?.status === 'fulfilled' ? (postResult as any).value.data : null;

      if (!post) {
        return new Response(
          `<!DOCTYPE html><html><head><title>Post não encontrado</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Post não encontrado</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      bodyHtml = renderBlogPost(post, hostname);
      pageTitle = post.seo_title || `${post.title} | ${storeName}`;
      pageDescription = post.seo_description || post.excerpt || '';
      canonicalPath = `/blog/${post.slug}`;
      ogImage = post.cover_image_url || ogImage;
      
      // LCP preload: blog cover image
      if (post.cover_image_url) {
        lcpPreloadTag = `<link rel="preload" as="image" href="${escapeHtml(optimizeImageUrl(post.cover_image_url, 1200, 85))}" fetchpriority="high">`;
      }

      // Increment view count (fire-and-forget)
      supabase.rpc('increment_blog_view_count', { post_id: post.id }).then(() => {}).catch(() => {});

    } else {
      // Unknown route — return minimal page, let client-side handle
      bodyHtml = `<div style="min-height:50vh;display:flex;align-items:center;justify-content:center;"><p style="color:#999;">Carregando...</p></div>`;
    }

    const totalMs = Date.now() - startTime;
    const canonicalUrl = `https://${hostname}${canonicalPath}`;

    // Build nav items for mobile menu
    const navItemsHtml = menuItems
      .filter((item: any) => !item.parent_id)
      .slice(0, 12)
      .map((item: any) => `<a href="${escapeHtml(item.url || '#')}">${escapeHtml(item.label)}</a>`)
      .join('');

    const html = buildFullPage({
      title: pageTitle,
      description: pageDescription,
      canonicalUrl,
      faviconUrl,
      ogImage,
      googleFontsLink,
      fontPreloadTags,
      lcpPreloadTag,
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
      navItemsHtml,
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
