// ============================================
// STOREFRONT HTML — Edge-Rendered Storefront POC
// v1.0.0: Returns real HTML above-the-fold for home page
// Resolves tenant from hostname, renders title/meta/header/hero as HTML
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantFromHostname, parsePlatformSubdomain } from '../_shared/resolveTenant.ts';

// ===== VERSION =====
const VERSION = "v1.0.0"; // POC: Edge-rendered home above the fold
// ====================

// ============================================
// FONT MAP (ported from usePublicThemeSettings.ts)
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
  // Already a wsrv URL or data URL
  if (url.startsWith('https://wsrv.nl') || url.startsWith('data:')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&output=webp`;
}

// ============================================
// THEME CSS GENERATOR (ported from getStorefrontThemeCss)
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
    'inter': 'Inter',
    'roboto': 'Roboto',
    'open-sans': 'Open+Sans',
    'lato': 'Lato',
    'montserrat': 'Montserrat',
    'poppins': 'Poppins',
    'nunito': 'Nunito',
    'raleway': 'Raleway',
    'mulish': 'Mulish',
    'work-sans': 'Work+Sans',
    'quicksand': 'Quicksand',
    'dm-sans': 'DM+Sans',
    'manrope': 'Manrope',
    'outfit': 'Outfit',
    'plus-jakarta-sans': 'Plus+Jakarta+Sans',
    'playfair': 'Playfair+Display',
    'merriweather': 'Merriweather',
    'lora': 'Lora',
    'oswald': 'Oswald',
    'bebas-neue': 'Bebas+Neue',
  };
  
  if (fontNameMap[headingFont]) fonts.add(fontNameMap[headingFont]);
  if (fontNameMap[bodyFont]) fonts.add(fontNameMap[bodyFont]);
  
  if (fonts.size === 0) return '';
  
  const families = Array.from(fonts).map(f => `family=${f}:wght@400;500;600;700`).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}

// ============================================
// BLOCK TREE WALKER — Extract first Banner/HeroBanner from template
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
    return {
      type: node.type,
      ...node.props,
    };
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
  
  // Build navigation links
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

  // Handle carousel mode — use first slide
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
  
  const alignMap: Record<string, string> = {
    left: 'flex-start', center: 'center', right: 'flex-end',
  };
  const justifyContent = alignMap[alignment] || 'center';

  const optimizedDesktop = optimizeImageUrl(imageDesktop, 1920, 85);
  const optimizedMobile = optimizeImageUrl(imageMobile || imageDesktop, 768, 80);

  // Preload hero image
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
      ${buttonText ? `<a href="${escapeHtml(buttonUrl || linkUrl || '#')}" style="display:inline-block;margin-top:8px;padding:12px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border-radius:6px;font-weight:600;font-size:16px;transition:transform .2s;">${escapeHtml(buttonText)}</a>` : ''}
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
// UTILITY
// ============================================
function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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

    // Resolve hostname from query param or request body
    const url = new URL(req.url);
    let hostname = url.searchParams.get('hostname') || '';
    
    // Also try Host header for direct proxying from Cloudflare Worker
    if (!hostname) {
      const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      // Don't use the Supabase function host
      if (forwardedHost && !forwardedHost.includes('supabase.co') && !forwardedHost.includes('functions.supabase.co')) {
        hostname = forwardedHost;
      }
    }

    // Also accept POST body for testing
    if (!hostname && req.method === 'POST') {
      try {
        const body = await req.json();
        hostname = body.hostname || '';
      } catch { /* ignore */ }
    }

    if (!hostname) {
      return new Response(
        JSON.stringify({ error: 'hostname required', usage: '?hostname=www.example.com' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    hostname = hostname.toLowerCase().trim();
    console.log(`[storefront-html] Resolving: ${hostname}`);

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

    // === STEP 2: Run critical queries in parallel ===
    const queryStart = Date.now();
    const [
      tenantResult,
      settingsResult,
      headerMenuResult,
      categoriesResult,
      templateResult,
    ] = await Promise.allSettled([
      // Q1: Tenant info
      supabase.from('tenants').select('id, name, slug, logo_url').eq('id', tenantId).maybeSingle(),
      // Q2: Store settings
      supabase.from('store_settings').select('store_name, logo_url, store_description, social_instagram, social_facebook, social_whatsapp, contact_phone, contact_email, is_published, favicon_url, seo_title, seo_description').eq('tenant_id', tenantId).maybeSingle(),
      // Q3: Header menu + items
      supabase.from('menus').select('*, menu_items(*)').eq('tenant_id', tenantId).eq('location', 'header').maybeSingle(),
      // Q4: Active categories (for menu fallback)
      supabase.from('categories').select('id, name, slug').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order').limit(10),
      // Q5: Published template (contains home content + themeSettings)
      supabase.from('storefront_template_sets').select('id, published_content, is_published, base_preset').eq('tenant_id', tenantId).eq('is_published', true).maybeSingle(),
    ]);
    const queryMs = Date.now() - queryStart;

    // Extract results
    const tenant = tenantResult.status === 'fulfilled' ? tenantResult.value.data : null;
    const storeSettings = settingsResult.status === 'fulfilled' ? settingsResult.value.data : null;
    const headerMenuRaw = headerMenuResult.status === 'fulfilled' ? headerMenuResult.value.data : null;
    const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value.data : [];
    const templateSet = templateResult.status === 'fulfilled' ? templateResult.value.data : null;

    console.log(`[storefront-html] tenantId=${tenantId}, storeSettings=${JSON.stringify(storeSettings ? { is_published: storeSettings.is_published, store_name: storeSettings.store_name } : null)}, settingsError=${settingsResult.status === 'fulfilled' ? JSON.stringify(settingsResult.value.error) : 'rejected'}`);

    // Not published?
    if (!storeSettings?.is_published) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Loja em construção</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;text-align:center;"><div><h1>Loja em construção</h1><p style="color:#666;">Esta loja ainda não está disponível para o público.</p></div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }
      );
    }

    // === STEP 3: Extract data for rendering ===
    const storeName = storeSettings?.store_name || tenant?.name || 'Loja';
    const storeDescription = storeSettings?.store_description || '';
    const faviconUrl = storeSettings?.favicon_url || '';
    const seoTitle = storeSettings?.seo_title || storeName;
    const seoDescription = storeSettings?.seo_description || storeDescription;
    const seoImage = storeSettings?.seo_image_url || storeSettings?.logo_url || tenant?.logo_url || '';

    // Extract themeSettings from template published_content
    const publishedContent = templateSet?.published_content as Record<string, any> | null;
    const themeSettings = publishedContent?.themeSettings || null;
    const homeContent = publishedContent?.home || null;

    // Find first banner/hero in home template
    const banner = findFirstBanner(homeContent);

    // Sort menu items
    const menuItems = headerMenuRaw?.menu_items 
      ? [...headerMenuRaw.menu_items].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : [];

    // === STEP 4: Render HTML ===
    const renderStart = Date.now();

    const themeCss = generateThemeCss(themeSettings);
    const googleFontsLink = getGoogleFontsLink(themeSettings);
    const headerHtml = renderHeader(storeSettings, tenant, menuItems, categories || [], tenantSlug);
    const bannerHtml = banner ? renderBanner(banner) : '';

    const canonicalUrl = `https://${hostname}/`;
    const totalMs = Date.now() - startTime;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(seoTitle)}</title>
  <meta name="description" content="${escapeHtml(seoDescription)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  ${faviconUrl ? `<link rel="icon" href="${escapeHtml(optimizeImageUrl(faviconUrl, 32, 90))}" type="image/x-icon">` : ''}
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(seoTitle)}">
  <meta property="og:description" content="${escapeHtml(seoDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  ${seoImage ? `<meta property="og:image" content="${escapeHtml(seoImage)}">` : ''}
  
  <!-- Fonts -->
  ${googleFontsLink}
  
  <!-- Critical CSS (inline) -->
  <style>${themeCss}</style>

  <!-- Server-Timing for diagnostics -->
  <!-- resolve=${resolveMs}ms, queries=${queryMs}ms, total=${totalMs}ms -->
</head>
<body>
  ${headerHtml}
  <main>
    ${bannerHtml}
    <!-- Below-the-fold content will be hydrated by JS -->
    <div id="sf-hydrate-root" data-tenant="${escapeHtml(tenantSlug)}" data-hostname="${escapeHtml(hostname)}"></div>
  </main>

  <!-- Performance marker -->
  <script>
    window.__SF_SERVER_RENDERED = true;
    window.__SF_TIMING = { resolve: ${resolveMs}, queries: ${queryMs}, total: ${totalMs} };
    window.__SF_TENANT = { slug: "${escapeHtml(tenantSlug)}", id: "${escapeHtml(tenantId)}" };
  </script>
</body>
</html>`;

    console.log(`[storefront-html] Rendered in ${totalMs}ms (resolve=${resolveMs}ms, queries=${queryMs}ms, render=${Date.now() - renderStart}ms)`);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300, max-age=60',
        'Server-Timing': `resolve;dur=${resolveMs}, queries;dur=${queryMs}, total;dur=${totalMs}`,
        'X-Storefront-Version': VERSION,
        'X-Tenant': tenantSlug,
      },
    });

  } catch (error) {
    console.error('[storefront-html] Fatal error:', error);
    const totalMs = Date.now() - startTime;
    return new Response(
      `<!DOCTYPE html><html><head><title>Erro</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Erro ao carregar a loja</h1></body></html>`,
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Server-Timing': `total;dur=${totalMs}`,
        } 
      }
    );
  }
});
