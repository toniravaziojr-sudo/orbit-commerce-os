// ============================================
// STOREFRONT HTML — Edge-Rendered Storefront
// v8.5.0: FIX — Cart format compatibility Edge↔SPA, prevents hydration crash when SPA saves {items,shipping}
// Resolves tenant from hostname, serves pre-rendered HTML if available,
// falls back to live rendering otherwise.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';
import { compileBlockTree, extractProductIds, extractCategoryIds } from '../_shared/block-compiler/index.ts';
import type { CompilerContext, BlockNode } from '../_shared/block-compiler/types.ts';
import { headerToStaticHTML } from '../_shared/block-compiler/blocks/header.ts';
import { footerToStaticHTML } from '../_shared/block-compiler/blocks/footer.ts';
import { blogIndexToStaticHTML, blogPostToStaticHTML } from '../_shared/block-compiler/blocks/blog.ts';
import { institutionalPageToStaticHTML } from '../_shared/block-compiler/blocks/institutional-page.ts';
import { generateThemeCss, generateButtonCssRules, getGoogleFontsData } from '../_shared/theme-tokens.ts';
import { optimizeImageUrl } from '../_shared/block-compiler/utils.ts';

// ===== VERSION =====
const VERSION = "v8.5.0"; // Fix: Cart format compatibility Edge↔SPA — prevents hydration crash
// ====================

// NOTE: FONT_FAMILY_MAP, getFontFamily, generateThemeCss, getGoogleFontsData
// are now imported from '../_shared/theme-tokens.ts' (centralized)

// NOTE: getGoogleFontsData is now imported from theme-tokens.ts

// ============================================
// BLOCK TREE WALKER — Extract first Banner/HeroBanner
// ============================================
interface BannerData {
  type: 'Banner' | 'HeroBanner';
  imageDesktop?: string;
  imageMobile?: string;
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
  
  // Product: /produto/slug OR /p/slug (SPA short prefix)
  const productMatch = clean.match(/^(?:produto|p)\/(.+)$/);
  if (productMatch) return { type: 'product', slug: productMatch[1] };
  
  // Category: /categoria/slug OR /c/slug (SPA short prefix)
  const categoryMatch = clean.match(/^(?:categoria|c)\/(.+)$/);
  if (categoryMatch) return { type: 'category', slug: categoryMatch[1] };

  const blogPostMatch = clean.match(/^blog\/(.+)$/);
  if (blogPostMatch) return { type: 'blog_post', slug: blogPostMatch[1] };

  if (clean === 'blog') return { type: 'blog_index' };
  
  // Institutional page: /page/slug
  const pageMatch = clean.match(/^page\/(.+)$/);
  if (pageMatch) return { type: 'page', slug: pageMatch[1] };
  
  // Landing page: /lp/slug
  const lpMatch = clean.match(/^lp\/(.+)$/);
  if (lpMatch) return { type: 'landing_page', slug: lpMatch[1] };
  
  const knownRoutes = ['carrinho', 'checkout', 'obrigado', 'rastreio', 'minha-conta', 'cart', 'conta'];
  if (knownRoutes.some(r => clean === r || clean.startsWith(r + '/'))) {
    return { type: 'unknown' };
  }
  
  // Generic fallback — treat as institutional page
  return { type: 'page', slug: clean };
}

// ============================================
// MARKETING PIXELS — Deferred script injection
// ============================================
function generateMarketingPixelScripts(config: any): string {
  if (!config) return '';
  const scripts: string[] = [];
  const prefetches: string[] = [];

  // Meta Pixel
  if (config.meta_enabled && config.meta_pixel_id) {
    prefetches.push('<link rel="dns-prefetch" href="https://connect.facebook.net">');
    const pixelId = escapeHtml(config.meta_pixel_id);
    scripts.push(`
    <script>
    (function(){
      function loadMeta(){
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${pixelId}');fbq('track','PageView');
      }
      if('requestIdleCallback' in window){requestIdleCallback(loadMeta,{timeout:3000});}
      else{setTimeout(loadMeta,2000);}
    })();
    </script>`);
  }

  // Google Analytics / Ads
  if (config.google_enabled && config.google_measurement_id) {
    prefetches.push('<link rel="dns-prefetch" href="https://www.googletagmanager.com">');
    const gaId = escapeHtml(config.google_measurement_id);
    const adsId = config.google_ads_conversion_id ? escapeHtml(config.google_ads_conversion_id) : '';
    scripts.push(`
    <script>
    (function(){
      function loadGA(){
        var s=document.createElement('script');s.async=true;
        s.src='https://www.googletagmanager.com/gtag/js?id=${gaId}';
        document.head.appendChild(s);
        window.dataLayer=window.dataLayer||[];
        function gtag(){dataLayer.push(arguments);}
        window.gtag=gtag;
        gtag('js',new Date());
        gtag('config','${gaId}',{send_page_view:true});
        ${adsId ? `gtag('config','${adsId}');` : ''}
      }
      if('requestIdleCallback' in window){requestIdleCallback(loadGA,{timeout:3000});}
      else{setTimeout(loadGA,2000);}
    })();
    </script>`);
  }

  // TikTok Pixel
  if (config.tiktok_enabled && config.tiktok_pixel_id) {
    prefetches.push('<link rel="dns-prefetch" href="https://analytics.tiktok.com">');
    const ttId = escapeHtml(config.tiktok_pixel_id);
    scripts.push(`
    <script>
    (function(){
      function loadTT(){
        !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e+'']=+new Date;ttq._o=ttq._o||{};ttq._o[e+'']=n||{};var o=document.createElement('script');o.type='text/javascript';o.async=!0;o.src=i+'?sdkid='+e+'&lib='+t;var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)}}(window,document,'ttq');
        ttq.load('${ttId}');ttq.page();
      }
      if('requestIdleCallback' in window){requestIdleCallback(loadTT,{timeout:3000});}
      else{setTimeout(loadTT,2000);}
    })();
    </script>`);
  }

  if (scripts.length === 0) return '';
  const guard = `<script>window._sfPixelsLoaded=true;</script>`;
  return prefetches.join('\n') + '\n' + guard + scripts.join('\n');
}

// ============================================
// NEWSLETTER POPUP — Edge-rendered popup
// ============================================
function generateNewsletterPopupHtml(config: any, tenantId: string, routeType: string): string {
  if (!config || !config.is_active) return '';

  const showOnPages: string[] = config.show_on_pages || ['home', 'category', 'product'];
  const pageTypeMap: Record<string, string> = { home: 'home', category: 'category', product: 'product', blog: 'blog', blog_post: 'blog', page: 'other' };
  const currentPageType = pageTypeMap[routeType] || 'other';
  if (showOnPages.length > 0 && !showOnPages.includes(currentPageType)) return '';

  const bgColor = escapeHtml(config.background_color || '#ffffff');
  const textColor = escapeHtml(config.text_color || '#1a1a1a');
  const btnBg = escapeHtml(config.button_bg_color || '#1a1a1a');
  const btnText = escapeHtml(config.button_text_color || '#ffffff');
  const title = escapeHtml(config.title || 'Receba nossas novidades');
  const subtitle = escapeHtml(config.subtitle || '');
  const buttonText = escapeHtml(config.button_text || 'Cadastrar');
  const successMsg = escapeHtml(config.success_message || 'Cadastrado com sucesso!');
  const triggerType = config.trigger_type || 'delay';
  const triggerDelay = (config.trigger_delay_seconds || 5) * 1000;
  const triggerScroll = config.trigger_scroll_percent || 50;
  const showOnce = config.show_once_per_session !== false;
  const listId = config.list_id || '';
  const layout = config.layout || 'centered';
  const imageUrl = config.image_url || '';

  const nameField = config.show_name ? `<input type="text" name="name" placeholder="Seu nome" ${config.name_required ? 'required' : ''} style="width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;font-family:inherit;">` : '';
  const emailField = `<input type="email" name="email" placeholder="Seu e-mail" required style="width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;font-family:inherit;">`;
  const phoneField = config.show_phone ? `<input type="tel" name="phone" placeholder="Seu telefone" ${config.phone_required ? 'required' : ''} style="width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;font-family:inherit;">` : '';

  // Mobile: hide image, render simple centered popup. Desktop: show side-image.
  const imageHtml = (layout === 'side-image' && imageUrl) ? `<div class="sf-popup-image" style="flex:1;min-width:200px;max-width:300px;"><img src="${escapeHtml(optimizeImageUrl(imageUrl, 400))}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px 0 0 12px;"></div>` : '';
  const isCorner = layout === 'corner';
  const popupWidth = isCorner ? 'max-width:360px;' : (layout === 'side-image' && imageUrl ? 'max-width:540px;' : 'max-width:500px;');

  return `
  <style>.sf-popup-image{display:none;}@media(min-width:640px){.sf-popup-image{display:block;}}.sf-popup-box{display:flex;gap:0;}@media(max-width:639px){.sf-popup-box{flex-direction:column!important;padding:20px 24px!important;max-width:95%!important;}}</style>
  <div id="sf-newsletter-popup" data-sf-newsletter-popup style="display:none;${isCorner ? 'position:fixed;bottom:20px;right:20px;z-index:95;' : 'position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;'}">
    <div class="sf-popup-box" style="${isCorner ? '' : 'position:relative;'}background:${bgColor};color:${textColor};border-radius:12px;padding:32px;${popupWidth}width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);${layout === 'side-image' ? 'flex-direction:row;padding:0;overflow:hidden;' : 'flex-direction:column;'}">
      ${imageHtml}
      <div style="${layout === 'side-image' ? 'flex:1;padding:32px;' : ''}">
        <button data-sf-action="close-newsletter-popup" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;color:${textColor};line-height:1;">&times;</button>
        <h3 style="font-size:20px;font-weight:700;margin-bottom:8px;">${title}</h3>
        ${subtitle ? `<p style="font-size:14px;opacity:0.8;margin-bottom:16px;">${subtitle}</p>` : ''}
        <form data-sf-newsletter-form style="display:flex;flex-direction:column;gap:10px;" data-tenant-id="${escapeHtml(tenantId)}" data-list-id="${escapeHtml(listId)}" data-popup-id="${escapeHtml(config.id)}">
          ${nameField}
          ${emailField}
          ${phoneField}
          <button type="submit" style="width:100%;padding:12px;background:${btnBg};color:${btnText};border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">${buttonText}</button>
        </form>
        <div data-sf-newsletter-success style="display:none;text-align:center;padding:20px 0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${btnBg}" stroke-width="2" style="margin:0 auto 12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p style="font-size:16px;font-weight:600;">${successMsg}</p>
        </div>
      </div>
    </div>
  </div>
  <script>
  (function(){
    var popup=document.getElementById("sf-newsletter-popup");
    if(!popup)return;
    var STORAGE_KEY="newsletter_popup_shown";
    var LEGACY_KEY="sf_newsletter_dismissed";
    var showOnce=${showOnce ? 'true' : 'false'};
    if(showOnce&&(sessionStorage.getItem(STORAGE_KEY)||sessionStorage.getItem(LEGACY_KEY)))return;
    function showPopup(){popup.style.display="${isCorner ? 'block' : 'flex'}";}
    function hidePopup(){popup.style.display="none";if(showOnce){sessionStorage.setItem(STORAGE_KEY,"1");sessionStorage.setItem(LEGACY_KEY,"1");}}
    var triggerType="${triggerType}";
    if(triggerType==="immediate"){showPopup();}
    else if(triggerType==="delay"){setTimeout(showPopup,${triggerDelay});}
    else if(triggerType==="scroll"){
      var fired=false;
      window.addEventListener("scroll",function(){
        if(fired)return;
        var pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
        if(pct>=${triggerScroll}){fired=true;showPopup();}
      });
    } else if(triggerType==="exit_intent"){
      document.addEventListener("mouseout",function(e){if(e.clientY<5)showPopup();});
    }
    popup.addEventListener("click",function(e){
      if(e.target.closest("[data-sf-action='close-newsletter-popup']"))hidePopup();
      if(e.target===popup&&!${isCorner})hidePopup();
    });
    var form=popup.querySelector("[data-sf-newsletter-form]");
    if(form)form.addEventListener("submit",function(e){
      e.preventDefault();
      var fd=new FormData(form);
      var email=fd.get("email");var name=fd.get("name")||"";var phone=fd.get("phone")||"";
      var tenantId=form.dataset.tenantId;var listId=form.dataset.listId;var popupId=form.dataset.popupId;
      var supabaseUrl="${Deno.env.get('SUPABASE_URL')}";
      var supabaseKey="${Deno.env.get('SUPABASE_ANON_KEY') || ''}";
      var btn=form.querySelector("button[type=submit]");
      if(btn){btn.disabled=true;btn.textContent="Enviando...";}
      fetch(supabaseUrl+"/functions/v1/newsletter-subscribe",{
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":supabaseKey,"Authorization":"Bearer "+supabaseKey},
        body:JSON.stringify({tenant_id:tenantId,email:email,name:name,phone:phone,list_id:listId||null,source:"popup",popup_id:popupId})
      }).then(function(r){return r.json()}).then(function(){
        form.style.display="none";
        popup.querySelector("[data-sf-newsletter-success]").style.display="block";
        if(showOnce)sessionStorage.setItem(STORAGE_KEY,"1");
        setTimeout(hidePopup,3000);
      }).catch(function(){if(btn){btn.disabled=false;btn.textContent="${buttonText}";}});
    });
  })();
  </script>`;
}

// ============================================
// CONSENT BANNER (LGPD)
// ============================================
function generateConsentBannerHtml(): string {
  return `
  <div id="sf-consent-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;background:#1a1a1a;color:#fff;padding:16px 24px;box-shadow:0 -4px 20px rgba(0,0,0,0.15);">
    <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <p style="font-size:13px;flex:1;min-width:200px;line-height:1.5;margin:0;">
        Utilizamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa
        <a href="/page/politica-de-privacidade" style="color:#93c5fd;text-decoration:underline;">Política de Privacidade</a>.
      </p>
      <div style="display:flex;gap:8px;">
        <button data-sf-consent="reject" style="padding:8px 16px;border:1px solid rgba(255,255,255,0.3);background:transparent;color:#fff;border-radius:6px;font-size:13px;cursor:pointer;">Rejeitar</button>
        <button data-sf-consent="accept" style="padding:8px 16px;border:none;background:#fff;color:#1a1a1a;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Aceitar</button>
      </div>
    </div>
  </div>
  <script>
  (function(){
    var banner=document.getElementById("sf-consent-banner");
    if(!banner)return;
    var CONSENT_KEY="sf_cookie_consent";
    var consent=localStorage.getItem(CONSENT_KEY);
    if(consent)return;
    banner.style.display="block";
    banner.addEventListener("click",function(e){
      var btn=e.target.closest("[data-sf-consent]");
      if(!btn)return;
      var val=btn.dataset.sfConsent;
      localStorage.setItem(CONSENT_KEY,val);
      banner.style.display="none";
      if(val==="accept"&&window.gtag){
        gtag("consent","update",{analytics_storage:"granted",ad_storage:"granted"});
      }
    });
  })();
  </script>`;
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
  mobileSearchHtml?: string;
  mobileBgColor?: string;
  mobileTextColor?: string;
  marketingScripts?: string;
  newsletterPopupHtml?: string;
  supportWidgetHtml?: string;
  consentBannerHtml?: string;
  benefitEnabled?: boolean;
  benefitThreshold?: number;
  benefitMode?: string;
  benefitRewardLabel?: string;
  benefitSuccessLabel?: string;
  benefitProgressColor?: string;
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
  
  <!-- Font preloading -->
  ${opts.fontPreloadTags || ''}
  ${opts.googleFontsLink}
  
  <!-- LCP image preload -->
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
    /* Notice bar fade rotation */
    @keyframes sf-notice-fade-in{0%{opacity:0}100%{opacity:1}}
    @keyframes sf-notice-fade-out{0%{opacity:1}100%{opacity:0}}
    .sf-notice-text{transition:opacity 300ms ease-out;}
    /* Header layout responsive */
    @media(max-width:768px){
      .sf-header-desktop{display:none !important;}
      .sf-nav-desktop{display:none !important;}
      .sf-header-mobile{display:flex !important;}
      .sf-header-mobile-secondary{display:flex !important;}
    }
    @media(min-width:769px){
      .sf-header-mobile{display:none !important;}
      .sf-header-mobile-secondary{display:none !important;}
    }
    /* Dropdown hover — mirrors SPA hover behavior */
    .sf-dropdown{padding:8px 0;}
    .sf-dropdown .sf-dropdown-menu{padding-top:12px;}
    .sf-dropdown:hover .sf-dropdown-menu{display:block !important;}
    .sf-dropdown-item:hover{background:rgba(0,0,0,0.04);color:var(--theme-button-primary-bg, #1a1a1a);}
    /* 3rd level sub-dropdown hover */
    .sf-sub-dropdown:hover > .sf-sub-dropdown-menu{display:block !important;}
    /* Chevron rotation on hover — mirrors SPA rotate-180 */
    .sf-dropdown:hover .sf-dropdown-trigger svg:last-child{transform:rotate(180deg);}
    /* Attendance dropdown — use padding-top bridge to prevent gap */
    .sf-attendance-dropdown .sf-attendance-menu{display:none !important;position:absolute;top:100%;right:0;padding-top:8px;min-width:280px;max-width:320px;z-index:60;}
    .sf-attendance-dropdown .sf-attendance-menu > div{padding:16px;background:#fff;border:1px solid #eee;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.12);}
    .sf-attendance-dropdown:hover .sf-attendance-menu{display:block !important;}
    .sf-attendance-item{display:flex;align-items:flex-start;gap:12px;padding:8px;border-radius:8px;text-decoration:none;color:inherit;transition:background 0.15s;}
    .sf-attendance-item:hover{background:#f5f5f5;}
    .sf-attendance-icon{margin-top:2px;padding:6px;border-radius:6px;display:flex;align-items:center;justify-content:center;}
    /* Featured promo thumbnail hover */
    .sf-featured-promo{position:relative;}
    .sf-featured-promo .sf-featured-thumb{display:none;position:absolute;top:100%;left:0;padding-top:8px;z-index:50;}
    .sf-featured-promo .sf-featured-thumb img{border-radius:8px 8px 0 0;}
    .sf-featured-promo .sf-featured-thumb > div:last-child{border-radius:0 0 8px 8px;}
    .sf-featured-promo:hover .sf-featured-thumb{display:block;}
    /* Button & tag styles — from centralized theme-tokens.ts */
    ${generateButtonCssRules()}
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
    .sf-mobile-nav{display:none;position:fixed;inset:0;z-index:90;overflow-y:auto;-webkit-overflow-scrolling:touch;flex-direction:column;gap:0;}
    .sf-mobile-nav.active{display:flex;}
    .sf-mobile-nav a{font-size:18px;font-weight:500;padding:16px 24px;border-bottom:1px solid rgba(128,128,128,0.15);display:block;text-decoration:none;}
    .sf-mobile-nav .sf-mobile-nav-item{font-size:18px;font-weight:500;padding:0;border-bottom:1px solid rgba(128,128,128,0.15);display:block;text-decoration:none;}
    .sf-mobile-nav .sf-mobile-contact{padding:16px 24px;border-top:1px solid rgba(128,128,128,0.15);}
    .sf-mobile-nav .sf-mobile-contact a{font-size:14px;padding:10px 0;border-bottom:none;}
    .sf-mobile-nav .sf-mobile-social{padding:16px 24px;border-top:1px solid rgba(128,128,128,0.15);}
    .sf-mobile-nav .sf-mobile-social a{display:inline-flex;padding:8px;border-bottom:none;}
    .sf-mobile-nav .sf-mobile-search{padding:12px 24px;border-bottom:1px solid rgba(128,128,128,0.15);}
    .sf-mobile-nav .sf-mobile-search input{width:100%;padding:10px 14px;border:1px solid rgba(128,128,128,0.3);border-radius:8px;font-size:14px;outline:none;background:rgba(255,255,255,0.1);color:inherit;font-family:var(--sf-body-font);}
    /* Cart drawer */
    .sf-cart-drawer{position:fixed;top:0;right:-400px;width:min(400px,100vw);height:100vh;background:#fff;z-index:110;transition:right .3s;box-shadow:-8px 0 24px rgba(0,0,0,0.15);display:flex;flex-direction:column;}
    .sf-cart-drawer.active{right:0;}
    .sf-cart-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:105;}
    .sf-cart-backdrop.active{display:block;}
  </style>

  <!-- Search Overlay -->
  <div class="sf-search-overlay" data-sf-search-overlay>
    <div class="sf-search-box">
      <input class="sf-search-input" data-sf-search-input type="text" placeholder="O que você procura?" autofocus>
      <div class="sf-search-results" data-sf-search-results></div>
    </div>
  </div>

  <!-- Mobile Nav -->
  <nav class="sf-mobile-nav" data-sf-mobile-nav style="background:${escapeHtml(opts.mobileBgColor || '#1a1a1a')};color:${escapeHtml(opts.mobileTextColor || '#ffffff')};">
    <button style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:inherit;z-index:2;" data-sf-action="toggle-mobile-menu">&times;</button>
    <div style="padding-top:48px;">
      ${opts.mobileSearchHtml || ''}
      ${opts.navItemsHtml || ''}
    </div>
  </nav>

  <!-- Cart Drawer -->
  <div class="sf-cart-backdrop" data-sf-cart-backdrop></div>
  <div class="sf-cart-drawer" data-sf-cart-drawer>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee;">
      <div style="display:flex;align-items:center;gap:8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <h3 style="font-size:16px;font-weight:600;">Carrinho</h3>
      </div>
      <button data-sf-action="toggle-cart" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;">&times;</button>
    </div>
    <div data-sf-cart-items style="flex:1;overflow-y:auto;padding:16px 20px;">
      <!-- Benefit bar injected by JS -->
      <div data-sf-cart-benefit style="display:none;margin-bottom:12px;"></div>
    </div>
    <div style="padding:16px 20px;border-top:1px solid #eee;">
      <!-- Shipping Calculator -->
      <div data-sf-cart-shipping style="margin-bottom:12px;">
        <p style="font-size:13px;font-weight:600;margin-bottom:6px;">📦 Calcular frete</p>
        <div style="display:flex;gap:8px;">
          <input type="text" placeholder="CEP" maxlength="9" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;outline:none;" data-sf-cart-shipping-cep>
          <button data-sf-action="calc-cart-shipping" style="padding:8px 14px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;">OK</button>
        </div>
        <div data-sf-cart-shipping-results style="margin-top:6px;"></div>
      </div>
      <!-- Coupon -->
      <div data-sf-cart-coupon style="margin-bottom:12px;">
        <div style="display:flex;gap:8px;">
          <input type="text" placeholder="Cupom de desconto" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;outline:none;" data-sf-cart-coupon-input>
          <button data-sf-action="apply-coupon" style="padding:8px 14px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;">Aplicar</button>
        </div>
        <div data-sf-cart-coupon-result style="margin-top:4px;font-size:12px;"></div>
      </div>
      <!-- Summary -->
      <div style="space-y:6px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;">
          <span>Subtotal:</span>
          <span data-sf-cart-subtotal style="font-weight:500;">R$ 0,00</span>
        </div>
        <div data-sf-cart-shipping-line style="display:none;justify-content:space-between;font-size:14px;margin-bottom:4px;">
          <span>Frete:</span>
          <span data-sf-cart-shipping-value>Calcule acima</span>
        </div>
        <div data-sf-cart-discount-line style="display:none;justify-content:space-between;font-size:14px;margin-bottom:4px;color:#16a34a;">
          <span>Desconto:</span>
          <span data-sf-cart-discount-value></span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #eee;margin-top:4px;">
          <span style="font-weight:700;font-size:16px;">Total:</span>
          <span data-sf-cart-total style="font-weight:700;font-size:18px;">R$ 0,00</span>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
        <a href="/checkout" class="sf-btn-primary" style="display:block;width:100%;padding:14px;text-align:center;border-radius:9999px;font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;">Iniciar Compra</a>
        <a href="/cart" class="sf-btn-secondary" style="display:block;width:100%;padding:12px;text-align:center;border-radius:9999px;font-weight:600;font-size:13px;text-decoration:none;">Ir para o Carrinho</a>
      </div>
    </div>
  </div>

  <script>
    (function(){
      // === HYDRATION GUARD: prevent double execution (bfcache, duplicate scripts) ===
      if(window.__SF_HYDRATED){console.warn("[SF] Hydration already ran, skipping duplicate.");return;}
      window.__SF_HYDRATED=true;

      // === ABORT CONTROLLER: allows cleanup of all document-level listeners ===
      if(window.__SF_ABORT){window.__SF_ABORT.abort();}
      window.__SF_ABORT=new AbortController();
      var sfSignal=window.__SF_ABORT.signal;

      // === BFCACHE HANDLER: force full reload when restored from back/forward cache ===
      window.addEventListener("pageshow",function(e){
        if(e.persisted){
          console.log("[SF] Page restored from bfcache — forcing reload for fresh state");
          window.__SF_HYDRATED=false;
          window.location.reload();
        }
      });
      var TENANT="${escapeHtml(opts.tenantSlug)}";
      var HOSTNAME="${escapeHtml(opts.hostname)}";
      var CART_KEY="storefront_cart_"+TENANT;
      // === CART FORMAT COMPATIBILITY (Edge↔SPA) ===
      // SPA (CartContext.tsx) saves: {items: [...], shipping: {...}}
      // Edge (legacy) saves: [...]
      // Must handle BOTH to prevent .reduce() TypeError that kills entire hydration
      var cart=[];
      var _cartShippingStored=null;
      try{
        var _rawCart=JSON.parse(localStorage.getItem(CART_KEY)||"[]");
        if(Array.isArray(_rawCart)){
          cart=_rawCart;
        }else if(_rawCart&&typeof _rawCart==="object"&&Array.isArray(_rawCart.items)){
          cart=_rawCart.items;
          _cartShippingStored=_rawCart.shipping||null;
        }
      }catch(e){console.warn("[SF] Cart parse error, resetting:",e);cart=[];}
      var cartShipping=null; // {name,price,days}
      var cartDiscount=null; // {code,type,value,free_shipping}
      var BENEFIT_ENABLED=${opts.benefitEnabled ? 'true' : 'false'};
      var BENEFIT_THRESHOLD=${opts.benefitThreshold || 0};
      var BENEFIT_MODE="${escapeHtml(opts.benefitMode || 'free_shipping')}";
      var BENEFIT_REWARD_LABEL="${escapeHtml(opts.benefitRewardLabel || 'Frete Grátis')}";
      var BENEFIT_SUCCESS_LABEL="${escapeHtml(opts.benefitSuccessLabel || 'Você ganhou frete grátis!')}";
      var BENEFIT_COLOR="${escapeHtml(opts.benefitProgressColor || '#22c55e')}";

      // Save cart in SPA-compatible format to prevent format mismatch crashes
      function saveCart(){
        try{
          var stored=null;
          try{stored=JSON.parse(localStorage.getItem(CART_KEY)||"null");}catch(e2){}
          if(stored&&typeof stored==="object"&&!Array.isArray(stored)){
            // SPA format — preserve shipping data, update items only
            stored.items=cart;
            localStorage.setItem(CART_KEY,JSON.stringify(stored));
          }else{
            // Write in SPA format for cross-compatibility
            localStorage.setItem(CART_KEY,JSON.stringify({items:cart,shipping:_cartShippingStored||{cep:"",options:[],selected:null}}));
          }
        }catch(e){console.warn("[SF] Cart save error:",e);}
        updateCartUI();
      }
      function fmt(v){return"R$ "+v.toFixed(2).replace(".",",");}

      function updateCartUI(){
        var subtotal=cart.reduce(function(s,i){return s+i.price*i.quantity},0);
        var count=cart.reduce(function(s,i){return s+i.quantity},0);
        document.querySelectorAll("[data-sf-cart-count]").forEach(function(el){
          el.textContent=count;el.style.display=count>0?"flex":"none";
        });
        // Subtotal
        var subEl=document.querySelector("[data-sf-cart-subtotal]");
        if(subEl)subEl.textContent=fmt(subtotal);
        // Shipping line
        var shLine=document.querySelector("[data-sf-cart-shipping-line]");
        var shVal=document.querySelector("[data-sf-cart-shipping-value]");
        if(shLine&&shVal){
          if(cartShipping){shLine.style.display="flex";shVal.textContent=cartShipping.price===0?'Grátis':fmt(cartShipping.price);}
          else{shLine.style.display="none";}
        }
        // Discount line
        var dLine=document.querySelector("[data-sf-cart-discount-line]");
        var dVal=document.querySelector("[data-sf-cart-discount-value]");
        var discountAmt=0;
        if(dLine&&dVal&&cartDiscount){
          if(cartDiscount.type==="percentage"){discountAmt=subtotal*(cartDiscount.value/100);}
          else{discountAmt=Math.min(cartDiscount.value,subtotal);}
          if(discountAmt>0){dLine.style.display="flex";dVal.textContent="-"+fmt(discountAmt);}
          else{dLine.style.display="none";}
        } else if(dLine){dLine.style.display="none";}
        // Total
        var shippingCost=cartShipping?cartShipping.price:0;
        var total=Math.max(0,subtotal-discountAmt+shippingCost);
        var totalEl=document.querySelector("[data-sf-cart-total]");
        if(totalEl)totalEl.textContent=fmt(total);
        // Items
        var itemsEl=document.querySelector("[data-sf-cart-items]");
        if(itemsEl){
          // Update benefit bar
          var benefitEl=itemsEl.querySelector("[data-sf-cart-benefit]");
          if(benefitEl){
            if(BENEFIT_ENABLED && BENEFIT_THRESHOLD>0 && cart.length>0){
              var progress=Math.min((subtotal/BENEFIT_THRESHOLD)*100,100);
              var remaining=Math.max(BENEFIT_THRESHOLD-subtotal,0);
              var achieved=subtotal>=BENEFIT_THRESHOLD;
              var accentColor=BENEFIT_COLOR||'#22c55e';
              var icon=BENEFIT_MODE==='gift'?'🎁':'🚚';
              if(achieved){
                benefitEl.style.display="block";
                benefitEl.innerHTML='<div style="padding:10px 12px;border-radius:8px;border:1px solid '+accentColor+';background:'+accentColor+'10;">'
                  +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
                  +'<span style="font-size:14px;">'+icon+'</span>'
                  +'<span style="font-size:13px;font-weight:600;color:'+accentColor+';">'+BENEFIT_SUCCESS_LABEL+'</span></div>'
                  +'<div style="height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden;"><div style="height:100%;width:100%;background:'+accentColor+';border-radius:3px;"></div></div></div>';
              } else {
                benefitEl.style.display="block";
                benefitEl.innerHTML='<div style="padding:10px 12px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;">'
                  +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
                  +'<span style="font-size:14px;">'+icon+'</span>'
                  +'<span style="font-size:13px;">Faltam <strong>R$ '+remaining.toFixed(2).replace(".",",")+'</strong> para '+BENEFIT_REWARD_LABEL.toLowerCase()+'</span></div>'
                  +'<div style="height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden;"><div style="height:100%;width:'+progress.toFixed(1)+'%;background:'+accentColor+';border-radius:3px;transition:width 0.3s;"></div></div></div>';
              }
            } else {
              benefitEl.style.display="none";
            }
          }
          if(cart.length===0){
            itemsEl.innerHTML=(benefitEl?benefitEl.outerHTML:'')+'<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#999;padding:32px 0;"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;margin-bottom:16px;"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg><p style="font-size:14px;">Seu carrinho está vazio</p></div>';
            return;
          }
          var bHtml=benefitEl?benefitEl.outerHTML:'';
          itemsEl.innerHTML=bHtml+cart.map(function(item,idx){
            return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f5f5f5;">'
              +'<div style="width:64px;height:64px;border-radius:8px;overflow:hidden;background:#f5f5f5;flex-shrink:0;">'+(item.image?'<img src="'+item.image+'" style="width:100%;height:100%;object-fit:cover;">':'')+'</div>'
              +'<div style="flex:1;min-width:0;">'
              +'<p style="font-size:13px;font-weight:500;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+item.name+'</p>'
              +'<p style="font-size:14px;font-weight:700;color:var(--theme-price-color,#1a1a1a);">'+fmt(item.price*item.quantity)+'</p>'
              +'<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">'
              +'<button data-sf-action="cart-item-minus" data-index="'+idx+'" style="width:28px;height:28px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;">−</button>'
              +'<span style="font-size:13px;font-weight:500;min-width:20px;text-align:center;">'+item.quantity+'</span>'
              +'<button data-sf-action="cart-item-plus" data-index="'+idx+'" style="width:28px;height:28px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;">+</button>'
              +'</div></div>'
              +'<button data-sf-action="remove-cart-item" data-index="'+idx+'" style="background:none;border:none;color:#999;cursor:pointer;font-size:16px;padding:4px;align-self:flex-start;">&times;</button></div>';
          }).join("");
        }
      }

      function addToCart(id,name,price,image,variantId,skipDrawer){
        var existing=cart.find(function(i){return i.product_id===id&&(i.variant_id||"")===(variantId||"")});
        if(existing){existing.quantity++;}else{
          cart.push({id:id+"_"+(variantId||"default")+"_"+Date.now(),product_id:id,variant_id:variantId||null,name:name,sku:"",price:parseFloat(price),quantity:1,image:image||"",image_url:image||""});
        }
        saveCart();
        if(!skipDrawer){
          document.querySelector("[data-sf-cart-drawer]")?.classList.add("active");
          document.querySelector("[data-sf-cart-backdrop]")?.classList.add("active");
        }
      }

      function doSearch(query){
        var resultsEl=document.querySelector("[data-sf-search-results]");
        if(!resultsEl)return;
        if(!query||query.length<2){resultsEl.innerHTML="";return;}
        resultsEl.innerHTML='<p style="text-align:center;color:#999;padding:16px;">Buscando...</p>';
        var supabaseUrl="${Deno.env.get('SUPABASE_URL')}";
        var supabaseKey="${Deno.env.get('SUPABASE_ANON_KEY') || ''}";
        fetch(supabaseUrl+"/rest/v1/products?tenant_id=eq.${opts.tenantId}&status=eq.active&deleted_at=is.null&name=ilike.*"+encodeURIComponent(query)+"*&select=id,name,slug,price,compare_at_price&limit=8",{
          headers:{"apikey":supabaseKey,"Authorization":"Bearer "+supabaseKey}
        }).then(function(r){return r.json()}).then(function(products){
          if(!products||products.length===0){resultsEl.innerHTML='<p style="text-align:center;color:#999;padding:16px;">Nenhum resultado</p>';return;}
          resultsEl.innerHTML=products.map(function(p){
            return '<a href="/produto/'+p.slug+'" class="sf-search-item"><div><p style="font-size:14px;font-weight:500;">'+p.name+'</p><p style="font-size:13px;color:#666;">R$ '+p.price.toFixed(2).replace(".",",")+'</p></div></a>';
          }).join("");
        }).catch(function(){resultsEl.innerHTML='<p style="text-align:center;color:#999;padding:16px;">Erro na busca</p>';});
      }

      // Init cart UI on load
      updateCartUI();

      // Event delegation — CAPTURE PHASE ensures this fires BEFORE
      // any inline handlers or <a> default navigation, fixing buttons
      // inside <a> tags in product grids even without inline onclick
      document.addEventListener("click",function(e){
        var btn=e.target.closest("[data-sf-action]");
        if(!btn||btn.disabled)return;
        var action=btn.dataset.sfAction;
        if(action==="toggle-search"){
          var overlay=document.querySelector("[data-sf-search-overlay]");
          overlay?.classList.toggle("active");
          if(overlay?.classList.contains("active"))document.querySelector("[data-sf-search-input]")?.focus();
        } else if(action==="toggle-mobile-menu"){
          document.querySelector("[data-sf-mobile-nav]")?.classList.toggle("active");
        } else if(action==="open-cart"||action==="toggle-cart"){
          document.querySelector("[data-sf-cart-drawer]")?.classList.toggle("active");
          document.querySelector("[data-sf-cart-backdrop]")?.classList.toggle("active");
        } else if(action==="add-to-cart"){
          e.preventDefault();e.stopPropagation();
          var qtyInput=document.querySelector("[data-sf-qty-input]");
          var qty=qtyInput?parseInt(qtyInput.value)||1:1;
          for(var q=0;q<qty;q++) addToCart(btn.dataset.productId, btn.dataset.productName, parseFloat(btn.dataset.productPrice), btn.dataset.productImage, btn.dataset.variantId);
          // Buy Together: if extra product data exists, add that too
          if(btn.dataset.extraProductId){addToCart(btn.dataset.extraProductId,btn.dataset.extraProductName,parseFloat(btn.dataset.extraProductPrice),btn.dataset.extraProductImage);}
        } else if(action==="buy-now"){
          e.preventDefault();e.stopPropagation();
          var qtyInput2=document.querySelector("[data-sf-qty-input]");
          var qty2=qtyInput2?parseInt(qtyInput2.value)||1:1;
          for(var q2=0;q2<qty2;q2++) addToCart(btn.dataset.productId, btn.dataset.productName, parseFloat(btn.dataset.productPrice), btn.dataset.productImage, btn.dataset.variantId, true);
          window.location.href="/checkout";
        } else if(action==="remove-cart-item"){
          var idx = parseInt(btn.dataset.index);
          cart.splice(idx,1); saveCart();
        } else if(action==="cart-item-minus"){
          var ci=parseInt(btn.dataset.index);
          if(cart[ci]){if(cart[ci].quantity>1){cart[ci].quantity--;}else{cart.splice(ci,1);}saveCart();}
        } else if(action==="cart-item-plus"){
          var ci2=parseInt(btn.dataset.index);
          if(cart[ci2]){cart[ci2].quantity++;saveCart();}
        } else if(action==="qty-minus"){
          var inp=document.querySelector("[data-sf-qty-input]");
          if(inp){var v=parseInt(inp.value)||1;if(v>1)inp.value=v-1;}
        } else if(action==="qty-plus"){
          var inp2=document.querySelector("[data-sf-qty-input]");
          if(inp2){var v2=parseInt(inp2.value)||1;var mx=parseInt(inp2.max)||99;if(v2<mx)inp2.value=v2+1;}
        } else if(action==="calc-shipping"){
          e.preventDefault();
          var box=btn.closest("[data-sf-shipping-box]");
          var cepInput=box?.querySelector("[data-sf-shipping-cep]");
          var resultsEl2=box?.querySelector("[data-sf-shipping-results]");
          if(!cepInput||!resultsEl2)return;
          var cep=cepInput.value.replace(/\D/g,"");
          if(cep.length!==8){resultsEl2.innerHTML='<p style="font-size:13px;color:#dc2626;">CEP inválido</p>';return;}
          resultsEl2.innerHTML='<p style="font-size:13px;color:#666;">Calculando...</p>';
          var pId=box.dataset.productId;
          var pPrice=parseFloat(box.dataset.productPrice)||0;
          var supabaseUrl2="${Deno.env.get('SUPABASE_URL')}";
          var supabaseKey2="${Deno.env.get('SUPABASE_ANON_KEY') || ''}";
          fetch(supabaseUrl2+"/functions/v1/shipping-quote",{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":supabaseKey2,"Authorization":"Bearer "+supabaseKey2,"x-store-host":HOSTNAME},
            body:JSON.stringify({recipient_cep:cep,store_host:HOSTNAME,items:[{quantity:1,price:pPrice,product_id:pId,weight:0.3}]})
          }).then(function(r){return r.json()}).then(function(data){
            if(!data.options||data.options.length===0){resultsEl2.innerHTML='<p style="font-size:13px;color:#666;">Nenhuma opção de frete disponível para este CEP.</p>';return;}
            resultsEl2.innerHTML=data.options.map(function(opt){
              var priceText=opt.is_free||opt.price===0?'<span style="color:#16a34a;font-weight:600;">Grátis</span>':'R$ '+opt.price.toFixed(2).replace(".",",");
              var daysText=opt.estimated_days===1?'1 dia útil':opt.estimated_days+' dias úteis';
              return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;"><div><p style="font-size:14px;font-weight:500;">'+opt.service_name+'</p><p style="font-size:12px;color:#666;">'+daysText+'</p></div><div style="font-size:14px;font-weight:600;">'+priceText+'</div></div>';
            }).join("");
          }).catch(function(){resultsEl2.innerHTML='<p style="font-size:13px;color:#dc2626;">Erro ao calcular frete. Tente novamente.</p>';});
        } else if(action==="calc-cart-shipping"){
          e.preventDefault();
          var cartCepInput=document.querySelector("[data-sf-cart-shipping-cep]");
          var cartShipResults=document.querySelector("[data-sf-cart-shipping-results]");
          if(!cartCepInput||!cartShipResults)return;
          var cartCep=cartCepInput.value.replace(/\D/g,"");
          if(cartCep.length!==8){cartShipResults.innerHTML='<p style="font-size:12px;color:#dc2626;">CEP inválido</p>';return;}
          cartShipResults.innerHTML='<p style="font-size:12px;color:#666;">Calculando...</p>';
          var cartSubtotal=cart.reduce(function(s,i){return s+i.price*i.quantity},0);
          var cartItems=cart.map(function(i){return{quantity:i.quantity,price:i.price,product_id:i.product_id,weight:0.3}});
          var sUrl="${Deno.env.get('SUPABASE_URL')}";
          var sKey="${Deno.env.get('SUPABASE_ANON_KEY') || ''}";
          fetch(sUrl+"/functions/v1/shipping-quote",{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":sKey,"Authorization":"Bearer "+sKey,"x-store-host":HOSTNAME},
            body:JSON.stringify({recipient_cep:cartCep,store_host:HOSTNAME,items:cartItems})
          }).then(function(r){return r.json()}).then(function(data){
            if(!data.options||data.options.length===0){cartShipResults.innerHTML='<p style="font-size:12px;color:#666;">Sem opções para este CEP.</p>';return;}
            cartShipResults.innerHTML=data.options.map(function(opt,oi){
              var pt=opt.is_free||opt.price===0?'Grátis':'R$ '+opt.price.toFixed(2).replace(".",",");
              var dt=opt.estimated_days===1?'1 dia':'~'+opt.estimated_days+' dias';
              return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;"><input type="radio" name="sf-cart-ship" value="'+oi+'" '+(oi===0?'checked':'')+' style="accent-color:var(--theme-button-primary-bg,#1a1a1a);"><span style="flex:1;">'+opt.service_name+' <span style="color:#666;font-size:11px;">('+dt+')</span></span><span style="font-weight:600;">'+pt+'</span></label>';
            }).join("");
            // Auto-select first
            var firstOpt=data.options[0];
            cartShipping={name:firstOpt.service_name,price:firstOpt.is_free?0:firstOpt.price,days:firstOpt.estimated_days};
            updateCartUI();
            // Radio change handler
            cartShipResults.querySelectorAll("input[name=sf-cart-ship]").forEach(function(radio,ri){
              radio.addEventListener("change",function(){
                var opt2=data.options[ri];
                cartShipping={name:opt2.service_name,price:opt2.is_free?0:opt2.price,days:opt2.estimated_days};
                updateCartUI();
              });
            });
          }).catch(function(){cartShipResults.innerHTML='<p style="font-size:12px;color:#dc2626;">Erro ao calcular.</p>';});
        } else if(action==="apply-coupon"){
          e.preventDefault();
          var couponInput=document.querySelector("[data-sf-cart-coupon-input]");
          var couponResult=document.querySelector("[data-sf-cart-coupon-result]");
          if(!couponInput||!couponResult)return;
          var code=couponInput.value.trim();
          if(!code){couponResult.innerHTML='<span style="color:#dc2626;">Digite um cupom</span>';return;}
          couponResult.innerHTML='<span style="color:#666;">Validando...</span>';
          var cSubtotal=cart.reduce(function(s,i){return s+i.price*i.quantity},0);
          var cUrl="${Deno.env.get('SUPABASE_URL')}";
          var cKey="${Deno.env.get('SUPABASE_ANON_KEY') || ''}";
          fetch(cUrl+"/functions/v1/validate-coupon",{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":cKey,"Authorization":"Bearer "+cKey,"x-store-host":HOSTNAME},
            body:JSON.stringify({code:code,subtotal:cSubtotal,store_host:HOSTNAME})
          }).then(function(r){return r.json()}).then(function(data){
            if(data.valid){
              cartDiscount={code:code,type:data.discount_type||"percentage",value:data.discount_value||0,free_shipping:data.free_shipping||false};
              couponResult.innerHTML='<span style="color:#16a34a;font-weight:500;">✓ Cupom aplicado!</span>';
              updateCartUI();
            }else{
              couponResult.innerHTML='<span style="color:#dc2626;">'+(data.message||'Cupom inválido')+'</span>';
            }
          }).catch(function(){couponResult.innerHTML='<span style="color:#dc2626;">Erro ao validar.</span>';});
        } else if(action==="close-newsletter-popup"){
          var popup=document.getElementById("sf-newsletter-popup");
          if(popup){popup.style.display="none";sessionStorage.setItem("sf_newsletter_dismissed","1");}
        }
      },{capture:true,signal:sfSignal}); // CAPTURE PHASE + AbortController for cleanup

      // CEP masks
      var cepEl=document.querySelector("[data-sf-shipping-cep]");
      if(cepEl)cepEl.addEventListener("input",function(){var v=this.value.replace(/\D/g,"");if(v.length>5)v=v.slice(0,5)+"-"+v.slice(5,8);else v=v.slice(0,8);this.value=v;});
      var cartCepEl=document.querySelector("[data-sf-cart-shipping-cep]");
      if(cartCepEl)cartCepEl.addEventListener("input",function(){var v=this.value.replace(/\D/g,"");if(v.length>5)v=v.slice(0,5)+"-"+v.slice(5,8);else v=v.slice(0,8);this.value=v;});

      // Search overlay close on click outside
      document.querySelector("[data-sf-search-overlay]")?.addEventListener("click",function(e){
        if(e.target===this)this.classList.remove("active");
      });

      // Cart backdrop close
      document.querySelector("[data-sf-cart-backdrop]")?.addEventListener("click",function(){
        document.querySelector("[data-sf-cart-drawer]")?.classList.remove("active");
        this.classList.remove("active");
      });

      // Search input
      var searchInput = document.querySelector("[data-sf-search-input]");
      if(searchInput) searchInput.addEventListener("input",function(){doSearch(this.value)});
      
      // Mobile search input — opens overlay and syncs query
      var mobileSearchInput = document.querySelector("[data-sf-mobile-search-input]");
      if(mobileSearchInput){
        mobileSearchInput.addEventListener("focus",function(){
          document.querySelector("[data-sf-mobile-nav]")?.classList.remove("active");
          document.querySelector("[data-sf-search-overlay]")?.classList.add("active");
          var mainInput = document.querySelector("[data-sf-search-input]");
          if(mainInput){mainInput.value=this.value;mainInput.focus();}
        });
      }

      // Mobile secondary bar search input — click opens overlay
      var mobileSecondarySearch = document.querySelector("[data-sf-action-click='toggle-search']");
      if(mobileSecondarySearch){
        mobileSecondarySearch.addEventListener("click",function(){
          document.querySelector("[data-sf-search-overlay]")?.classList.add("active");
          var mainInput = document.querySelector("[data-sf-search-input]");
          if(mainInput) mainInput.focus();
        });
      }

      // ESC key
      document.addEventListener("keydown",function(e){
        if(e.key==="Escape"){
          document.querySelector("[data-sf-search-overlay]")?.classList.remove("active");
          document.querySelector("[data-sf-cart-drawer]")?.classList.remove("active");
          document.querySelector("[data-sf-cart-backdrop]")?.classList.remove("active");
          document.querySelector("[data-sf-mobile-nav]")?.classList.remove("active");
        }
      },{signal:sfSignal});

      // Init cart UI on load
      updateCartUI();

      // === NOTICE BAR TEXT ROTATION (fade/slide modes) ===
      var noticeBar=document.querySelector(".sf-notice-bar[data-sf-notice-texts]");
      if(noticeBar){
        try{
          var texts=JSON.parse(noticeBar.dataset.sfNoticeTexts||"[]");
          var anim=noticeBar.dataset.sfNoticeAnimation||"fade";
          if(texts.length>1){
            var idx=0;
            var span=noticeBar.querySelector(".sf-notice-text");
            if(span){
              setInterval(function(){
                // Exit animation
                if(anim==="fade"){span.style.opacity="0";}
                else if(anim==="slide-vertical"){span.style.opacity="0";span.style.transform="translateY(-100%)";}
                else if(anim==="slide-horizontal"){span.style.opacity="0";span.style.transform="translateX(-100%)";}
                setTimeout(function(){
                  idx=(idx+1)%texts.length;
                  span.textContent=texts[idx];
                  // Enter from reset position
                  if(anim==="slide-vertical"){span.style.transform="translateY(100%)";}
                  else if(anim==="slide-horizontal"){span.style.transform="translateX(100%)";}
                  requestAnimationFrame(function(){
                    requestAnimationFrame(function(){
                      span.style.opacity="1";
                      span.style.transform="translateY(0) translateX(0)";
                    });
                  });
                },300);
              },4000);
            }
          }
        }catch(e){}
      }

      // === PRODUCT VARIANT SELECTOR HYDRATION ===
      var variantSelector=document.querySelector("[data-sf-variant-selector]");
      if(variantSelector){
        var variantDataEl=variantSelector.querySelector("[data-sf-variant-data]");
        var variants=variantDataEl?JSON.parse(variantDataEl.textContent||"[]"):[];
        var selectedOpts={};
        var allOptionBtns=[].slice.call(variantSelector.querySelectorAll("[data-sf-variant-option]"));

        function findMatchingVariant(){
          var optNames=Object.keys(selectedOpts);
          // Count how many option groups exist
          var groupEls=variantSelector.querySelectorAll("[data-sf-variant-group]");
          if(optNames.length!==groupEls.length)return null;
          return variants.find(function(v){
            return optNames.every(function(name){
              var val=selectedOpts[name];
              if(v.o1n===name&&v.o1v===val)return true;
              if(v.o2n===name&&v.o2v===val)return true;
              if(v.o3n===name&&v.o3v===val)return true;
              return false;
            });
          })||null;
        }

        function updateVariantUI(variant){
          // Update price display
          var priceEl=document.querySelector("[data-sf-pdp-price]");
          if(!priceEl){
            // Fallback: find the main price element in the info column
            var infoCol=document.querySelector(".sf-pdp-grid")?.children[1];
            if(infoCol){
              var priceDivs=infoCol.querySelectorAll("span");
              for(var pi=0;pi<priceDivs.length;pi++){
                if(priceDivs[pi].style.fontSize==="28px"){priceEl=priceDivs[pi];break;}
              }
            }
          }
          if(variant&&priceEl){
            priceEl.textContent="R$ "+variant.price.toFixed(2).replace(".",",");
          }
          // Update stock text
          var stockEl=document.querySelector("[data-sf-stock-text]");
          if(variant&&stockEl){
            var sq=variant.stock_quantity||0;
            if(sq>0&&sq<=5){stockEl.textContent="Últimas "+sq+" unidades!";stockEl.style.color="#dc2626";}
            else if(sq>5){stockEl.textContent="Em estoque";stockEl.style.color="#16a34a";}
            else{stockEl.textContent="Indisponível";stockEl.style.color="#dc2626";}
          }
          // Update gallery main image if variant has image
          if(variant&&variant.image_url){
            var mainImg=document.querySelector(".sf-pdp-grid img[fetchpriority]");
            if(mainImg)mainImg.src=variant.image_url.indexOf("wsrv.nl")>=0?variant.image_url:"https://wsrv.nl/?url="+encodeURIComponent(variant.image_url)+"&w=800&q=85&output=webp";
          }
          // Update CTA buttons with variant ID
          if(variant){
            document.querySelectorAll("[data-sf-action='add-to-cart'],[data-sf-action='buy-now']").forEach(function(btn){
              if(btn.closest("[data-sf-variant-selector]"))return;// skip if inside variant selector
              btn.dataset.variantId=variant.id;
              btn.dataset.productPrice=variant.price;
              btn.disabled=false;
              btn.style.opacity="1";
            });
            // Update qty max
            var qtyInput=document.querySelector("[data-sf-qty-input]");
            if(qtyInput)qtyInput.max=variant.stock_quantity||99;
          }
        }

        allOptionBtns.forEach(function(btn){
          btn.addEventListener("click",function(){
            var name=this.dataset.optionName;
            var value=this.dataset.optionValue;
            selectedOpts[name]=value;
            // Update button styles
            var groupBtns=variantSelector.querySelectorAll('[data-sf-variant-option][data-option-name="'+name+'"]');
            groupBtns.forEach(function(gb){
              if(gb.dataset.optionValue===value){
                gb.style.borderColor="var(--theme-button-primary-bg,#1a1a1a)";
                gb.style.background="var(--theme-button-primary-bg,#1a1a1a)";
                gb.style.color="var(--theme-button-primary-text,#fff)";
              }else{
                gb.style.borderColor="#ddd";
                gb.style.background="#fff";
                gb.style.color="#1a1a1a";
              }
            });
            // Update selected label
            var labelEl=variantSelector.querySelector('[data-sf-variant-selected-label="'+name+'"]');
            if(labelEl)labelEl.textContent=value;
            // Find matching variant
            var match=findMatchingVariant();
            updateVariantUI(match);
          });
        });

        // If product has variants, disable CTA until variant is selected
        var groupCount=variantSelector.querySelectorAll("[data-sf-variant-group]").length;
        if(groupCount>0){
          document.querySelectorAll("[data-sf-action='add-to-cart'],[data-sf-action='buy-now']").forEach(function(btn){
            if(btn.closest("[data-sf-variant-selector]"))return;
            btn.disabled=true;
            btn.style.opacity="0.5";
          });
        }
      }

      // === GALLERY HYDRATION: Swipe dots + Thumbnail click ===
      var galleryTrack=document.querySelector("[data-sf-gallery-track]");
      if(galleryTrack){
        var dots=[].slice.call(document.querySelectorAll("[data-sf-dot-index]"));
        var slides=[].slice.call(galleryTrack.querySelectorAll(".sf-gallery-slide"));
        var scrollTimeout;
        galleryTrack.addEventListener("scroll",function(){
          clearTimeout(scrollTimeout);
          scrollTimeout=setTimeout(function(){
            var scrollLeft=galleryTrack.scrollLeft;
            var slideW=galleryTrack.offsetWidth;
            var idx=Math.round(scrollLeft/slideW);
            dots.forEach(function(d,i){d.classList.toggle("active",i===idx);});
          },50);
        });
        dots.forEach(function(dot){
          dot.addEventListener("click",function(){
            var idx=parseInt(this.dataset.sfDotIndex)||0;
            galleryTrack.scrollTo({left:idx*galleryTrack.offsetWidth,behavior:"smooth"});
          });
        });
      }
      // Desktop thumbnail click → swap main image
      var thumbsContainer=document.querySelector("[data-sf-gallery-thumbs]");
      var mainGalleryImg=document.querySelector("[data-sf-gallery-main]");
      var currentMainIdx=0;
      if(thumbsContainer&&mainGalleryImg){
        thumbsContainer.addEventListener("click",function(e){
          var img=e.target.closest("img");
          if(!img)return;
          var fullSrc=img.src.replace(/w=120/,"w=800").replace(/q=75/,"q=85");
          mainGalleryImg.src=fullSrc;
          var allThumbs=[].slice.call(thumbsContainer.querySelectorAll("img"));
          currentMainIdx=allThumbs.indexOf(img)+1;
          mainGalleryImg.dataset.sfLightboxTrigger=String(currentMainIdx);
          allThumbs.forEach(function(t){
            t.style.borderColor=t===img?"var(--theme-button-primary-bg,#1a1a1a)":"#eee";
            t.style.borderWidth=t===img?"2px":"1px";
          });
        });
      }

      // === LIGHTBOX: Zoom + Navigation ===
      var lightbox=document.querySelector("[data-sf-lightbox]");
      if(lightbox){
        var lbImg=lightbox.querySelector("[data-sf-lightbox-img]");
        var lbCounter=lightbox.querySelector("[data-sf-lightbox-counter]");
        var lbClose=lightbox.querySelector("[data-sf-lightbox-close]");
        var lbZoomIn=lightbox.querySelector("[data-sf-lightbox-zoom-in]");
        var lbZoomOut=lightbox.querySelector("[data-sf-lightbox-zoom-out]");
        var lbPrev=lightbox.querySelector("[data-sf-lightbox-prev]");
        var lbNext=lightbox.querySelector("[data-sf-lightbox-next]");
        // Collect all gallery image URLs (full size)
        var gallerySrcs=[];
        var galleyAlts=[];
        var desktopMain=document.querySelector("[data-sf-gallery-main]");
        if(desktopMain){
          gallerySrcs.push(desktopMain.src);
          galleyAlts.push(desktopMain.alt||"");
        }
        if(thumbsContainer){
          [].slice.call(thumbsContainer.querySelectorAll("img")).forEach(function(t){
            var fullSrc=t.src.replace(/w=120/,"w=800").replace(/q=75/,"q=85");
            gallerySrcs.push(fullSrc);
            galleyAlts.push(t.alt||"");
          });
        }
        // Fallback: use mobile slides if no desktop images
        if(gallerySrcs.length===0&&galleryTrack){
          [].slice.call(galleryTrack.querySelectorAll("[data-sf-gallery-slide-img]")).forEach(function(img){
            gallerySrcs.push(img.src);
            galleyAlts.push(img.alt||"");
          });
        }
        var lbCurrentIdx=0;
        var lbZoom=1;
        function lbShow(idx){
          if(gallerySrcs.length===0)return;
          lbCurrentIdx=Math.max(0,Math.min(idx,gallerySrcs.length-1));
          lbImg.src=gallerySrcs[lbCurrentIdx];
          lbImg.alt=galleyAlts[lbCurrentIdx]||"";
          lbZoom=1;
          lbImg.style.transform="scale(1)";
          if(lbCounter)lbCounter.textContent=(lbCurrentIdx+1)+" / "+gallerySrcs.length;
          lightbox.classList.add("open");
          document.body.style.overflow="hidden";
        }
        function lbHide(){
          lightbox.classList.remove("open");
          document.body.style.overflow="";
          lbZoom=1;
          lbImg.style.transform="scale(1)";
        }
        function lbSetZoom(z){
          lbZoom=Math.max(0.5,Math.min(z,4));
          lbImg.style.transform="scale("+lbZoom+")";
        }
        // Open triggers
        document.addEventListener("click",function(e){
          var trigger=e.target.closest("[data-sf-lightbox-trigger]");
          if(trigger){
            var idx=parseInt(trigger.dataset.sfLightboxTrigger)||0;
            lbShow(idx);
          }
        },{signal:sfSignal});
        if(lbClose)lbClose.addEventListener("click",lbHide);
        lightbox.addEventListener("click",function(e){if(e.target===lightbox)lbHide();});
        document.addEventListener("keydown",function(e){
          if(!lightbox.classList.contains("open"))return;
          if(e.key==="Escape")lbHide();
          if(e.key==="ArrowLeft"&&gallerySrcs.length>1)lbShow(lbCurrentIdx-1);
          if(e.key==="ArrowRight"&&gallerySrcs.length>1)lbShow(lbCurrentIdx+1);
          if(e.key==="+"||e.key==="=")lbSetZoom(lbZoom+0.25);
          if(e.key==="-")lbSetZoom(lbZoom-0.25);
        },{signal:sfSignal});
        if(lbZoomIn)lbZoomIn.addEventListener("click",function(){lbSetZoom(lbZoom+0.25);});
        if(lbZoomOut)lbZoomOut.addEventListener("click",function(){lbSetZoom(lbZoom-0.25);});
        if(lbPrev)lbPrev.addEventListener("click",function(){lbShow(lbCurrentIdx-1);});
        if(lbNext)lbNext.addEventListener("click",function(){lbShow(lbCurrentIdx+1);});
        // Pinch-to-zoom on mobile
        var pinchStartDist=0;var pinchStartZoom=1;
        lbImg.addEventListener("touchstart",function(e){
          if(e.touches.length===2){
            pinchStartDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
            pinchStartZoom=lbZoom;
            e.preventDefault();
          }
        },{passive:false});
        lbImg.addEventListener("touchmove",function(e){
          if(e.touches.length===2){
            var dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
            var scale=dist/pinchStartDist;
            lbSetZoom(pinchStartZoom*scale);
            e.preventDefault();
          }
        },{passive:false});
        // Double-tap to toggle zoom
        var lastTap=0;
        lbImg.addEventListener("touchend",function(e){
          if(e.touches.length>0)return;
          var now=Date.now();
          if(now-lastTap<300){
            lbSetZoom(lbZoom>1?1:2);
            e.preventDefault();
          }
          lastTap=now;
        });
      }

      // === CATEGORY FILTERS, SORT & LOAD MORE ===
      var catContainer=document.querySelector("[data-sf-cat-container]");
      if(catContainer){
        var allCards=[].slice.call(catContainer.querySelectorAll("[data-sf-product-card]"));
        var pageSize=parseInt(catContainer.dataset.pageSize)||24;
        var currentPage=1;
        var activeFilters={freeShipping:false,onSale:false,priceMin:null,priceMax:null};
        var currentSort="default";

        function applyFiltersAndSort(){
          var visible=allCards.filter(function(card){
            var price=parseFloat(card.dataset.price)||0;
            var fs=card.dataset.freeShipping==="1";
            var hd=card.dataset.hasDiscount==="1";
            if(activeFilters.freeShipping&&!fs)return false;
            if(activeFilters.onSale&&!hd)return false;
            if(activeFilters.priceMin!==null&&price<activeFilters.priceMin)return false;
            if(activeFilters.priceMax!==null&&price>activeFilters.priceMax)return false;
            return true;
          });

          // Sort
          if(currentSort!=="default"){
            visible.sort(function(a,b){
              if(currentSort==="price-asc")return parseFloat(a.dataset.price)-parseFloat(b.dataset.price);
              if(currentSort==="price-desc")return parseFloat(b.dataset.price)-parseFloat(a.dataset.price);
              if(currentSort==="name-asc")return a.dataset.name.localeCompare(b.dataset.name);
              if(currentSort==="name-desc")return b.dataset.name.localeCompare(a.dataset.name);
              if(currentSort==="discount")return parseInt(b.dataset.discountPct||"0")-parseInt(a.dataset.discountPct||"0");
              return 0;
            });
          }

          // Hide all first
          allCards.forEach(function(c){c.style.display="none";c.style.order="";});

          // Show visible up to current page
          var showCount=currentPage*pageSize;
          visible.forEach(function(c,i){
            if(i<showCount){c.style.display="";c.style.order=i;}
            else c.style.display="none";
          });

          // Reorder DOM for sort (move visible to front via CSS order)
          // Update count
          var countEl=catContainer.querySelector("[data-sf-cat-count]");
          if(countEl)countEl.textContent=visible.length+" produto"+(visible.length!==1?"s":"");

          // Load more button
          var lmWrap=catContainer.querySelector("[data-sf-load-more-wrap]");
          var lmInfo=catContainer.querySelector("[data-sf-load-more-info]");
          if(lmWrap){
            if(visible.length>showCount){
              lmWrap.style.display="";
              if(lmInfo)lmInfo.textContent="Exibindo "+Math.min(showCount,visible.length)+" de "+visible.length+" produtos";
            }else{
              lmWrap.style.display="none";
            }
          }

          // No results
          var noRes=catContainer.querySelector("[data-sf-no-results]");
          var grid=catContainer.querySelector("[data-sf-cat-grid]");
          if(noRes&&grid){
            noRes.style.display=visible.length===0?"":"none";
            grid.style.display=visible.length===0?"none":"";
          }
        }

        // Filter checkboxes
        var fsCb=catContainer.querySelector('[data-sf-filter="free-shipping"]');
        if(fsCb)fsCb.addEventListener("change",function(){activeFilters.freeShipping=this.checked;currentPage=1;applyFiltersAndSort();});
        var osCb=catContainer.querySelector('[data-sf-filter="on-sale"]');
        if(osCb)osCb.addEventListener("change",function(){activeFilters.onSale=this.checked;currentPage=1;applyFiltersAndSort();});

        // Price range
        var pMin=catContainer.querySelector('[data-sf-filter="price-min"]');
        var pMax=catContainer.querySelector('[data-sf-filter="price-max"]');
        var priceTimeout;
        function onPriceChange(){
          clearTimeout(priceTimeout);
          priceTimeout=setTimeout(function(){
            activeFilters.priceMin=pMin&&pMin.value?parseFloat(pMin.value):null;
            activeFilters.priceMax=pMax&&pMax.value?parseFloat(pMax.value):null;
            currentPage=1;
            applyFiltersAndSort();
          },400);
        }
        if(pMin)pMin.addEventListener("input",onPriceChange);
        if(pMax)pMax.addEventListener("input",onPriceChange);

        // Sort
        var sortEl=catContainer.querySelector("[data-sf-sort]");
        if(sortEl)sortEl.addEventListener("change",function(){currentSort=this.value;currentPage=1;applyFiltersAndSort();});

        // Load more
        document.addEventListener("click",function(e2){
          var btn2=e2.target.closest("[data-sf-action]");
          if(!btn2)return;
          if(btn2.dataset.sfAction==="load-more"){
            currentPage++;applyFiltersAndSort();
            window.scrollBy({top:-100,behavior:"smooth"});
          }
          if(btn2.dataset.sfAction==="clear-filters"){
            activeFilters={freeShipping:false,onSale:false,priceMin:null,priceMax:null};
            currentSort="default";
            if(fsCb)fsCb.checked=false;
            if(osCb)osCb.checked=false;
            if(pMin)pMin.value="";
            if(pMax)pMax.value="";
            if(sortEl)sortEl.value="default";
            currentPage=1;
            applyFiltersAndSort();
          }
        },{signal:sfSignal});
      }
    })();
  </script>
  ${opts.newsletterPopupHtml || ''}
  ${opts.consentBannerHtml || ''}
  ${opts.marketingScripts || ''}
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

    // === STEP 1.5: Check pre-rendered pages (fast path) ===
    const bypassPrerender = req.headers.get('x-prerender-bypass') === '1';
    const normalizedPath = path === '' ? '/' : path.replace(/\/+$/, '') || '/';

    if (!bypassPrerender) {
      const { data: prerendered } = await supabase
        .from('storefront_prerendered_pages')
        .select('html_content, generated_at, metadata')
        .eq('tenant_id', tenantId)
        .eq('path', normalizedPath)
        .eq('status', 'active')
        .maybeSingle();

      if (prerendered?.html_content) {
        const totalMs = Date.now() - startTime;
        console.log(`[storefront-html][${VERSION}] PRE-RENDERED HIT: ${normalizedPath} (resolve=${resolveMs}ms, total=${totalMs}ms)`);
        return new Response(prerendered.html_content, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800, max-age=120',
            'Server-Timing': `resolve;dur=${resolveMs}, total;dur=${totalMs}`,
            'X-Storefront-Version': VERSION,
            'X-Tenant': tenantSlug,
            'X-Render-Mode': 'prerendered',
            'X-Prerender-At': prerendered.generated_at || '',
          },
        });
      }
    }

    // === STEP 2: LIVE FALLBACK — Run base queries in parallel ===
    console.log(`[storefront-html][${VERSION}] ${bypassPrerender ? 'BYPASS MODE' : 'No prerender for'} ${normalizedPath}, live render`);
    const queryStart = Date.now();
    
    // Base queries (all pages need these) — order doesn't matter, extracted by name
    const baseQueryMap = {
      tenant: supabase.from('tenants').select('id, name, slug, logo_url').eq('id', tenantId).maybeSingle(),
      storeSettings: supabase.from('store_settings').select('store_name, logo_url, store_description, social_instagram, social_facebook, social_whatsapp, social_tiktok, social_youtube, contact_phone, contact_email, contact_address, contact_support_hours, business_legal_name, business_cnpj, is_published, favicon_url, seo_title, seo_description, benefit_config').eq('tenant_id', tenantId).maybeSingle(),
      headerMenu: supabase.from('menus').select('*, menu_items(*)').eq('tenant_id', tenantId).eq('location', 'header').maybeSingle(),
      categories: supabase.from('categories').select('id, name, slug').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order').limit(200),
      templateSet: supabase.from('storefront_template_sets').select('id, published_content, is_published, base_preset').eq('tenant_id', tenantId).eq('is_published', true).maybeSingle(),
      globalLayout: supabase.from('storefront_global_layout').select('header_config, published_header_config, footer_config, published_footer_config, header_enabled, footer_enabled').eq('tenant_id', tenantId).maybeSingle(),
      footerMenus: supabase.from('menus').select('id, name, location, menu_items(id, label, url, item_type, ref_id, sort_order)').eq('tenant_id', tenantId).in('location', ['footer', 'footer_1', 'footer_2']),
      publishedPages: supabase.from('store_pages').select('id, slug, type, is_published').eq('tenant_id', tenantId).eq('is_published', true),
      marketingConfig: supabase.from('marketing_integrations').select('meta_pixel_id, meta_enabled, google_measurement_id, google_ads_conversion_id, google_enabled, tiktok_pixel_id, tiktok_enabled, consent_mode_enabled').eq('tenant_id', tenantId).maybeSingle(),
      newsletterPopup: supabase.from('newsletter_popup_configs').select('id, is_active, title, subtitle, button_text, success_message, show_name, show_phone, show_birth_date, name_required, phone_required, birth_date_required, layout, image_url, icon_image_url, trigger_type, trigger_delay_seconds, trigger_scroll_percent, show_on_pages, background_color, text_color, button_bg_color, button_text_color, show_once_per_session, list_id').eq('tenant_id', tenantId).eq('is_active', true).limit(1).maybeSingle(),
      freeShippingRules: supabase.from('shipping_free_rules').select('min_order_cents').eq('tenant_id', tenantId).eq('is_enabled', true),
    };

    // Route-specific query (only one per request)
    let routeQueryPromise: Promise<any> | null = null;
    if (route.type === 'product' && route.slug) {
      routeQueryPromise = supabase.from('products')
        .select('id, name, slug, sku, price, compare_at_price, description, short_description, brand, stock_quantity, status, free_shipping, seo_title, seo_description, has_variants, tags, avg_rating, review_count, allow_backorder')
        .eq('tenant_id', tenantId).eq('slug', route.slug).is('deleted_at', null).maybeSingle();
    } else if (route.type === 'category' && route.slug) {
      routeQueryPromise = supabase.from('categories')
        .select('id, name, slug, description, image_url, banner_desktop_url, banner_mobile_url, seo_title, seo_description')
        .eq('tenant_id', tenantId).eq('slug', route.slug).eq('is_active', true).maybeSingle();
    } else if (route.type === 'page' && route.slug) {
      routeQueryPromise = supabase.from('store_pages')
        .select('id, title, slug, body_html, description, seo_title, seo_description, content, is_published')
        .eq('tenant_id', tenantId).eq('slug', route.slug).eq('is_published', true).maybeSingle();
    } else if (route.type === 'blog_post' && route.slug) {
      routeQueryPromise = supabase.from('blog_posts')
        .select('id, title, slug, excerpt, content, body_html, cover_image_url, published_at, created_at, author_name, seo_title, seo_description, status')
        .eq('tenant_id', tenantId).eq('slug', route.slug).eq('status', 'published').maybeSingle();
    } else if (route.type === 'blog_index') {
      routeQueryPromise = supabase.from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, published_at, author_name')
        .eq('tenant_id', tenantId).eq('status', 'published').order('published_at', { ascending: false }).limit(24);
    }

    // Execute ALL queries in parallel — base + route
    const baseKeys = Object.keys(baseQueryMap) as (keyof typeof baseQueryMap)[];
    const basePromises = baseKeys.map(k => baseQueryMap[k]);
    const allPromises = routeQueryPromise ? [...basePromises, routeQueryPromise] : basePromises;
    const allResults = await Promise.allSettled(allPromises);
    const queryMs = Date.now() - queryStart;

    // === Extract base results BY NAME (immune to index shifts) ===
    const baseResults: Record<string, any> = {};
    baseKeys.forEach((key, idx) => {
      const r = allResults[idx];
      baseResults[key] = r?.status === 'fulfilled' ? (r as any).value.data : null;
    });

    const tenant = baseResults.tenant;
    const storeSettings = baseResults.storeSettings;
    const headerMenuRaw = baseResults.headerMenu;
    const categories = baseResults.categories || [];
    const templateSet = baseResults.templateSet;
    const globalLayout = baseResults.globalLayout;
    const footerMenusRaw = baseResults.footerMenus || [];
    const publishedPages = baseResults.publishedPages || [];
    const marketingConfig = baseResults.marketingConfig;
    const newsletterPopup = baseResults.newsletterPopup;
    const freeShippingRulesData = baseResults.freeShippingRules || [];

    // Derive benefit config for edge cart drawer
    const benefitConfig = storeSettings?.benefit_config || null;
    let benefitThreshold = 0;
    if (benefitConfig?.enabled) {
      // Priority: logistics rules threshold > legacy thresholdValue
      const thresholds = (freeShippingRulesData as any[])
        .filter((r: any) => r.min_order_cents != null && r.min_order_cents > 0)
        .map((r: any) => r.min_order_cents as number);
      if (thresholds.length > 0) {
        benefitThreshold = Math.min(...thresholds) / 100; // cents → reais
      } else {
        benefitThreshold = Number(benefitConfig.thresholdValue) || 200;
      }
    }

    // Route-specific result — ALWAYS the last element, safe from base query additions
    const routeData = routeQueryPromise
      ? (allResults[baseKeys.length]?.status === 'fulfilled' ? (allResults[baseKeys.length] as any).value.data : null)
      : null;

    // Build footer menus structure with URL resolution and unpublished page filtering
    const footer1Menu = footerMenusRaw.find((m: any) => m.location === 'footer_1' || m.location === 'footer');
    const footer2Menu = footerMenusRaw.find((m: any) => m.location === 'footer_2');
    
    // Helper: resolve menu item URL based on item_type + ref_id
    // Used by header, footer, and mobile nav — mirrors buildMenuItemUrl() from SPA
    const resolveMenuItemUrl = (item: any): any | null => {
      const itemType = item.item_type === 'link' ? 'external' : item.item_type;
      
      if (itemType === 'external') {
        return item.url ? { ...item, url: item.url } : null;
      }
      if (itemType === 'category') {
        if (!item.ref_id) return null;
        const cat = (categories || []).find((c: any) => c.id === item.ref_id);
        if (!cat) return null;
        return { ...item, url: `/categoria/${cat.slug}` };
      }
      if (itemType === 'page') {
        if (!item.ref_id) return null;
        const page = publishedPages.find((p: any) => p.id === item.ref_id);
        if (!page) return null; // Page not published or doesn't exist
        const prefix = page.type === 'landing_page' ? '/lp/' : '/page/';
        return { ...item, url: `${prefix}${page.slug}` };
      }
      if (itemType === 'blog') {
        return { ...item, url: '/blog' };
      }
      if (itemType === 'tracking') {
        return { ...item, url: '/rastreio' };
      }
      return item.url ? item : null;
    };
    
    const resolveMenuItems = (items: any[]): any[] => {
      if (!items) return [];
      return items.map(resolveMenuItemUrl).filter(Boolean);
    };
    
    const footerMenus = {
      footer1: footer1Menu ? { name: footer1Menu.name, items: resolveMenuItems(footer1Menu.menu_items || []) } : { name: '', items: [] },
      footer2: footer2Menu ? { name: footer2Menu.name, items: resolveMenuItems(footer2Menu.menu_items || []) } : { name: '', items: [] },
    };

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
      ? resolveMenuItems([...headerMenuRaw.menu_items].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
      : [];
    
    // Extract settings
    const pageSettings = themeSettings?.pageSettings as Record<string, any> | undefined;
    const categorySettings = pageSettings?.category || null;
    const productSettings = pageSettings?.product || null;

    // Build compiler context (shared by header, footer, and home)
    const compilerContext: CompilerContext = {
      tenantSlug,
      hostname,
      products: new Map(),
      productImages: new Map(),
      categories: new Map((categories || []).map((c: any) => [c.id, c])),
      themeSettings,
      categorySettings,
      productSettings,
      storeSettings,
      menuItems,
      footerMenus,
      globalLayout,
      tenant,
      productBadges: new Map(),
    };

    // Generate header and footer using block-compiler
    const headerHtml = headerToStaticHTML(compilerContext);
    const footerHtml = footerToStaticHTML(compilerContext);

    // === STEP 3: Route-specific rendering ===
    let bodyHtml = '';
    let pageTitle = storeSettings?.seo_title || storeName;
    let pageDescription = storeSettings?.seo_description || storeSettings?.store_description || '';
    let canonicalPath = '/';
    let ogImage = storeSettings?.logo_url || tenant?.logo_url || '';
    let extraHead = '';
    let lcpPreloadTag = '';

    if (route.type === 'home') {
      // HOME — render using Block Compiler
      const homeContent = publishedContent?.home as BlockNode | null;
      
      if (homeContent) {
        const neededProductIds = extractProductIds(homeContent);
        const neededCategoryIds = extractCategoryIds(homeContent);
        
        const homeDataQueries: Promise<any>[] = [];
        
        if (neededProductIds.length > 0) {
          homeDataQueries.push(
            supabase.from('products')
              .select('id, name, slug, price, compare_at_price, status, free_shipping, avg_rating, review_count')
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
        
        // Update compiler context with home-specific data
        compilerContext.products = new Map(featuredProducts.map((p: any) => [p.id, p]));
        for (const img of productImages) {
          if (!compilerContext.productImages.has(img.product_id) || img.is_primary) {
            compilerContext.productImages.set(img.product_id, img.url);
          }
        }
        compilerContext.categories = new Map(featuredCategories.map((c: any) => [c.id, c]));
        
        // Fetch dynamic badges for home products
        if (featuredProducts.length > 0) {
          const pIds = featuredProducts.map((p: any) => p.id);
          const { data: badgeRows } = await supabase
            .from('product_badge_assignments')
            .select('product_id, badge:product_badges(id, name, background_color, text_color, shape, position, is_active)')
            .in('product_id', pIds);
          if (badgeRows) {
            for (const row of badgeRows as any[]) {
              if (row.badge?.is_active) {
                const existing = compilerContext.productBadges.get(row.product_id) || [];
                existing.push(row.badge);
                compilerContext.productBadges.set(row.product_id, existing);
              }
            }
          }
        }
        
        bodyHtml = compileBlockTree(homeContent, compilerContext);
        console.log(`[storefront-html][${VERSION}] Home compiled via block-compiler`);
      }
      
      // LCP preload
      const banner = findFirstBanner(publishedContent?.home);
      if (banner) {
        const desktopImg = banner.mode === 'carousel' && banner.slides?.[0]
          ? (banner.slides[0].imageDesktop || banner.imageDesktop)
          : banner.imageDesktop;
        const mobileImg = banner.mode === 'carousel' && banner.slides?.[0]
          ? (banner.slides[0].imageMobile || banner.slides[0].imageDesktop || banner.imageMobile || desktopImg)
          : (banner.imageMobile || desktopImg);
        
        const optDesktop = optimizeImageUrl(desktopImg, 1920, 85);
        const optMobile = optimizeImageUrl(mobileImg, 768, 80);
        
        if (optDesktop && optMobile && optDesktop !== optMobile) {
          lcpPreloadTag = `<link rel="preload" as="image" imagesrcset="${escapeHtml(optMobile)} 768w, ${escapeHtml(optDesktop)} 1920w" imagesizes="100vw" fetchpriority="high">`;
        } else if (optDesktop) {
          lcpPreloadTag = `<link rel="preload" as="image" href="${escapeHtml(optDesktop)}" fetchpriority="high">`;
        }
      }

    } else if (route.type === 'product' && route.slug) {
      // PRODUCT — using block-compiler with published_content.product tree
      const product = routeData;

      if (!product || product.status !== 'active') {
        return new Response(
          `<!DOCTYPE html><html><head><title>Produto não encontrado</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Produto não encontrado</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // Fetch images, category breadcrumb, reviews, related products, buy-together, and variants in parallel
      const [imagesResult, categoryResult, reviewsResult, relatedResult, buyTogetherResult, variantsResult] = await Promise.all([
        supabase
          .from('product_images')
          .select('id, url, alt_text, is_primary, sort_order')
          .eq('product_id', product.id)
          .order('sort_order'),
        supabase
          .from('product_categories')
          .select('categories!inner(name, slug)')
          .eq('product_id', product.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('product_reviews')
          .select('id, customer_name, rating, title, content, created_at, is_verified_purchase, media_urls')
          .eq('product_id', product.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(20),
        // Related products: get IDs then fetch product data
        supabase
          .from('related_products')
          .select('related_product_id, position')
          .eq('product_id', product.id)
          .order('position')
          .limit(8),
        supabase
          .from('buy_together_rules')
          .select('id, title, discount_type, discount_value, suggested_product_id')
          .eq('trigger_product_id', product.id)
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Variants
        product.has_variants ? supabase
          .from('product_variants')
          .select('id, sku, price, compare_at_price, stock_quantity, image_url, is_active, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value')
          .eq('product_id', product.id)
          .eq('is_active', true)
          .order('position', { ascending: true }) : Promise.resolve({ data: [] }),
      ]);
      const images = imagesResult.data;
      const productCategory = categoryResult.data?.categories;
      const reviews = reviewsResult.data || [];
      const relatedIds = (relatedResult.data || []).map((r: any) => r.related_product_id);

      // Fetch related products and buy-together suggested product in parallel
      const secondaryQueries: Promise<any>[] = [];
      if (relatedIds.length > 0) {
        secondaryQueries.push(
          supabase.from('products')
            .select('id, name, slug, price, compare_at_price, free_shipping, avg_rating, review_count, product_images(url, is_primary, sort_order)')
            .in('id', relatedIds)
            .eq('status', 'active')
            .is('deleted_at', null)
        );
      } else {
        secondaryQueries.push(Promise.resolve({ data: [] }));
      }
      const btRule = buyTogetherResult.data;
      if (btRule?.suggested_product_id) {
        secondaryQueries.push(
          supabase.from('products')
            .select('id, name, slug, price, compare_at_price, product_images(url, is_primary, sort_order)')
            .eq('id', btRule.suggested_product_id)
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle()
        );
      } else {
        secondaryQueries.push(Promise.resolve({ data: null }));
      }
      const [relatedProductsResult, btProductResult] = await Promise.all(secondaryQueries);

      // Build related products list preserving order
      const relatedProductsRaw = relatedProductsResult.data || [];
      const relatedProducts = relatedIds
        .map((id: string) => relatedProductsRaw.find((p: any) => p.id === id))
        .filter(Boolean)
        .map((p: any) => {
          const primaryImg = p.product_images?.find((i: any) => i.is_primary) || p.product_images?.[0];
          return { ...p, image_url: primaryImg?.url || '', product_images: undefined };
        });

      // Build buy-together context
      let buyTogetherCtx: any = undefined;
      if (btRule && btProductResult.data) {
        const sp = btProductResult.data;
        const spImg = sp.product_images?.find((i: any) => i.is_primary) || sp.product_images?.[0];
        buyTogetherCtx = {
          id: btRule.id,
          title: btRule.title,
          discount_type: btRule.discount_type,
          discount_value: btRule.discount_value,
          suggestedProduct: {
            id: sp.id, name: sp.name, slug: sp.slug, price: sp.price,
            compare_at_price: sp.compare_at_price, image_url: spImg?.url || '',
          },
        };
      }

      // Inject route-specific data into compiler context
      compilerContext.currentProduct = product;
      compilerContext.currentProductImages = images || [];
      compilerContext.currentProductReviews = reviews;
      compilerContext.currentRelatedProducts = relatedProducts;
      compilerContext.currentBuyTogether = buyTogetherCtx;
      compilerContext.currentProductVariants = variantsResult.data || [];
      if (productCategory) {
        compilerContext.currentProductCategory = { name: productCategory.name, slug: productCategory.slug };
      }

      // Use published_content.product block tree if available
      const productContent = publishedContent?.product as BlockNode | null;
      if (productContent) {
        bodyHtml = compileBlockTree(productContent, compilerContext);
        console.log(`[storefront-html][${VERSION}] Product compiled via compileBlockTree(published_content.product)`);
      } else {
        // Fallback: default product template structure
        const defaultProductTree: BlockNode = {
          id: 'root', type: 'Page', props: {},
          children: [
            { id: 'h', type: 'Header', props: {} },
            { id: 's', type: 'Section', props: { paddingY: 32 }, children: [
              { id: 'pd', type: 'ProductDetails', props: {} },
            ]},
            { id: 'f', type: 'Footer', props: {} },
          ],
        };
        bodyHtml = compileBlockTree(defaultProductTree, compilerContext);
        console.log(`[storefront-html][${VERSION}] Product compiled via default block tree (no published_content.product)`);
      }

      pageTitle = product.seo_title || `${product.name} | ${storeName}`;
      pageDescription = product.seo_description || product.short_description || '';
      canonicalPath = `/produto/${product.slug}`;
      ogImage = images?.[0]?.url || ogImage;
      
      const mainImg = images?.find((i: any) => i.is_primary) || images?.[0];
      if (mainImg?.url) {
        lcpPreloadTag = `<link rel="preload" as="image" href="${escapeHtml(optimizeImageUrl(mainImg.url, 800, 85))}" fetchpriority="high">`;
      }

    } else if (route.type === 'category' && route.slug) {
      // CATEGORY — using block-compiler with published_content.category tree
      const category = routeData;

      if (!category) {
        return new Response(
          `<!DOCTYPE html><html><head><title>Categoria não encontrada</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Categoria não encontrada</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      const { data: categoryProducts } = await supabase
        .from('product_categories')
        .select(`
          products!inner(id, name, slug, price, compare_at_price, stock_quantity, status, free_shipping, avg_rating, review_count,
            product_images(url, is_primary, sort_order)
          )
        `)
        .eq('category_id', category.id)
        .eq('products.tenant_id', tenantId)
        .eq('products.status', 'active')
        .is('products.deleted_at', null)
        .limit(200);

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

      // Inject route-specific data into compiler context
      compilerContext.currentCategory = category;
      compilerContext.categoryProducts = flatProducts;

      // Fetch dynamic badges for category products
      if (flatProducts.length > 0) {
        const catPIds = flatProducts.map((p: any) => p.id);
        const { data: catBadgeRows } = await supabase
          .from('product_badge_assignments')
          .select('product_id, badge:product_badges(id, name, background_color, text_color, shape, position, is_active)')
          .in('product_id', catPIds);
        if (catBadgeRows) {
          compilerContext.productBadges = new Map();
          for (const row of catBadgeRows as any[]) {
            if (row.badge?.is_active) {
              const existing = compilerContext.productBadges.get(row.product_id) || [];
              existing.push(row.badge);
              compilerContext.productBadges.set(row.product_id, existing);
            }
          }
        }
      }

      // Use published_content.category block tree if available
      const categoryContent = publishedContent?.category as BlockNode | null;
      if (categoryContent) {
        // Auto-inject CategoryBanner if template doesn't include one but category has banner
        const hasCategoryBanner = JSON.stringify(categoryContent).includes('"CategoryBanner"');
        if (!hasCategoryBanner && category.banner_desktop_url) {
          // Inject banner before the compiled content
          const bannerNode: BlockNode = {
            id: 'auto-cb', type: 'CategoryBanner',
            props: { showTitle: true, titlePosition: 'center', overlayOpacity: 0, height: 'md' },
          };
          const { categoryBannerToStaticHTML: bannerCompiler } = await import('../_shared/block-compiler/blocks/category-banner.ts');
          const bannerHtml = bannerCompiler(bannerNode.props, compilerContext, '');
          bodyHtml = bannerHtml + compileBlockTree(categoryContent, compilerContext);
          console.log(`[storefront-html][${VERSION}] Category compiled with auto-injected CategoryBanner`);
        } else {
          bodyHtml = compileBlockTree(categoryContent, compilerContext);
          console.log(`[storefront-html][${VERSION}] Category compiled via compileBlockTree(published_content.category)`);
        }
      } else {
        // Fallback: default category template structure
        const defaultCategoryTree: BlockNode = {
          id: 'root', type: 'Page', props: {},
          children: [
            { id: 'h', type: 'Header', props: {} },
            { id: 'cb', type: 'CategoryBanner', props: { showTitle: true, titlePosition: 'center', overlayOpacity: 0, height: 'md' } },
            { id: 's', type: 'Section', props: { paddingY: 0 }, children: [
              { id: 'cpl', type: 'CategoryPageLayout', props: { showFilters: true, columns: 4, limit: 24 } },
            ]},
            { id: 'f', type: 'Footer', props: {} },
          ],
        };
        bodyHtml = compileBlockTree(defaultCategoryTree, compilerContext);
        console.log(`[storefront-html][${VERSION}] Category compiled via default block tree (no published_content.category)`);
      }

      pageTitle = category.seo_title || `${category.name} | ${storeName}`;
      pageDescription = category.seo_description || category.description || '';
      canonicalPath = `/categoria/${category.slug}`;
      ogImage = category.banner_desktop_url || category.image_url || ogImage;

    } else if (route.type === 'page' && route.slug) {
      // INSTITUTIONAL PAGE — using block-compiler
      const page = routeData;

      if (!page) {
        return new Response(
          `<!DOCTYPE html><html><head><title>Página não encontrada</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Página não encontrada</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      bodyHtml = institutionalPageToStaticHTML(page);
      pageTitle = page.seo_title || `${page.title} | ${storeName}`;
      pageDescription = page.seo_description || page.description || '';
      canonicalPath = `/p/${page.slug}`;

    } else if (route.type === 'blog_index') {
      // BLOG INDEX — using block-compiler
      const posts = routeData || [];

      bodyHtml = blogIndexToStaticHTML(posts, storeName);
      pageTitle = `Blog | ${storeName}`;
      pageDescription = `Confira as últimas novidades do ${storeName}`;
      canonicalPath = '/blog';

    } else if (route.type === 'blog_post' && route.slug) {
      // BLOG POST — using block-compiler
      const post = routeData;

      if (!post) {
        return new Response(
          `<!DOCTYPE html><html><head><title>Post não encontrado</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><h1>Post não encontrado</h1></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      bodyHtml = blogPostToStaticHTML(post, hostname);
      pageTitle = post.seo_title || `${post.title} | ${storeName}`;
      pageDescription = post.seo_description || post.excerpt || '';
      canonicalPath = `/blog/${post.slug}`;
      ogImage = post.cover_image_url || ogImage;
      
      if (post.cover_image_url) {
        lcpPreloadTag = `<link rel="preload" as="image" href="${escapeHtml(optimizeImageUrl(post.cover_image_url, 1200, 85))}" fetchpriority="high">`;
      }

      // Increment view count (fire-and-forget)
      supabase.rpc('increment_blog_view_count', { post_id: post.id }).then(() => {}).catch(() => {});

    } else if (route.type === 'unknown') {
      // SPA-only route (cart, conta, rastreio, etc.) — should NOT be Edge-rendered
      // Return 204 so Cloudflare worker falls through to SPA
      console.log(`[storefront-html][${VERSION}] SPA-only route: ${normalizedPath}, returning 204`);
      return new Response(null, {
        status: 204,
        headers: {
          'X-Storefront-Version': VERSION,
          'X-Route': 'spa-only',
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      bodyHtml = `<div style="min-height:50vh;display:flex;align-items:center;justify-content:center;"><p style="color:#999;">Página não encontrada</p></div>`;
    }

    const totalMs = Date.now() - startTime;
    const canonicalUrl = `https://${hostname}${canonicalPath}`;

    // Build nav items for mobile menu — matches builder mobile drawer
    const headerConfig = globalLayout?.published_header_config || globalLayout?.header_config || null;
    const hProps = headerConfig?.props || {};
    const mobileHeaderBg = String(hProps.headerBgColor || '#ffffff');
    const mobileHeaderText = String(hProps.headerTextColor || '#1a1a1a');
    const mobileCustomerAreaEnabled = Boolean(hProps.customerAreaEnabled);
    const mobileFeaturedPromosEnabled = Boolean(hProps.featuredPromosEnabled);
    const mobileFeaturedPromosLabel = String(hProps.featuredPromosLabel || 'Promoções');
    const mobileFeaturedPromosTarget = String(hProps.featuredPromosTarget || hProps.featuredPromosDestination || '');
    let mobileFeaturedUrl = '#';
    if (mobileFeaturedPromosTarget.startsWith('category:')) mobileFeaturedUrl = `/categoria/${mobileFeaturedPromosTarget.replace('category:', '')}`;
    else if (mobileFeaturedPromosTarget.startsWith('page:')) mobileFeaturedUrl = `/page/${mobileFeaturedPromosTarget.replace('page:', '')}`;
    
    // Build child map for mobile
    const mobileChildrenMap = new Map<string, any[]>();
    menuItems.filter((item: any) => item.parent_id).forEach((item: any) => {
      const arr = mobileChildrenMap.get(item.parent_id) || [];
      arr.push(item);
      mobileChildrenMap.set(item.parent_id, arr);
    });
    
    const mobileMenuItemsHtml = menuItems
      .filter((item: any) => !item.parent_id)
      
      .map((item: any) => {
        const children = mobileChildrenMap.get(item.id) || [];
        if (children.length > 0) {
          const childLinks = children
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((child: any) => `<a href="${escapeHtml(child.url || '#')}" style="font-size:15px;padding:10px 24px 10px 40px;opacity:0.8;">${escapeHtml(child.label)}</a>`)
            .join('');
          return `<div class="sf-mobile-nav-item">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;cursor:pointer;" onclick="var sub=this.nextElementSibling;var arrow=this.querySelector('svg');if(sub.style.display==='none'){sub.style.display='flex';arrow.style.transform='rotate(180deg)';}else{sub.style.display='none';arrow.style.transform='rotate(0)';}">
              <span style="font-size:18px;font-weight:500;">${escapeHtml(item.label)}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div style="display:none;flex-direction:column;border-top:1px solid rgba(128,128,128,0.1);">${childLinks}</div>
          </div>`;
        }
        return `<a href="${escapeHtml(item.url || '#')}">${escapeHtml(item.label)}</a>`;
      }).join('');
    
    // Mobile contact section
    const mobileWhatsApp = storeSettings?.social_whatsapp || '';
    const mobilePhone = storeSettings?.contact_phone || '';
    const mobileEmail = storeSettings?.contact_email || '';
    const mobileSocialFacebook = storeSettings?.social_facebook || '';
    const mobileSocialInstagram = storeSettings?.social_instagram || '';
    const mobileSocialTiktok = storeSettings?.social_tiktok || '';
    const mobileSocialYoutube = storeSettings?.social_youtube || '';
    const mobileContact: string[] = [];
    if (mobileWhatsApp) mobileContact.push(`<a href="https://wa.me/${mobileWhatsApp.replace(/\\D/g, '')}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg> WhatsApp</a>`);
    if (mobilePhone) mobileContact.push(`<a href="tel:${mobilePhone.replace(/\\D/g, '')}" style="display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.87.36 1.72.7 2.53a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.81.34 1.66.57 2.53.7A2 2 0 0 1 22 16.92z"/></svg> Telefone</a>`);
    if (mobileEmail) mobileContact.push(`<a href="mailto:${escapeHtml(mobileEmail)}" style="display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Email</a>`);
    
    const mobileContactHtml = mobileContact.length > 0 ? `<div class="sf-mobile-contact"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.6;margin-bottom:12px;">CONTATO</div>${mobileContact.join('')}</div>` : '';
    
    // Social links for mobile menu
    const mobileSocialLinks: string[] = [];
    if (mobileSocialFacebook) mobileSocialLinks.push(`<a href="${escapeHtml(mobileSocialFacebook)}" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>`);
    if (mobileSocialInstagram) mobileSocialLinks.push(`<a href="${escapeHtml(mobileSocialInstagram)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg></a>`);
    if (mobileSocialTiktok) mobileSocialLinks.push(`<a href="${escapeHtml(mobileSocialTiktok)}" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg></a>`);
    if (mobileSocialYoutube) mobileSocialLinks.push(`<a href="${escapeHtml(mobileSocialYoutube)}" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg></a>`);
    const mobileSocialHtml = mobileSocialLinks.length > 0 ? `<div class="sf-mobile-social"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;opacity:0.6;margin-bottom:12px;">REDES SOCIAIS</div><div style="display:flex;gap:12px;">${mobileSocialLinks.join('')}</div></div>` : '';
    
    // Featured promo for mobile
    const mobileFeaturedHtml = mobileFeaturedPromosEnabled ? `<a href="${escapeHtml(mobileFeaturedUrl)}" style="font-weight:600;">${escapeHtml(mobileFeaturedPromosLabel)}</a>` : '';
    
    // Account for mobile
    const mobileAccountHtml = mobileCustomerAreaEnabled ? `<a href="/conta" style="display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Minha Conta</a>` : '';
    
    // Search bar for mobile
    const mobileShowSearch = hProps.showSearch ?? true;
    const mobileSearchHtml = mobileShowSearch ? `<div class="sf-mobile-search"><input type="text" placeholder="O que você procura?" data-sf-mobile-search-input></div>` : '';
    
    const navItemsHtml = `<div style="background:${escapeHtml(mobileHeaderBg)};color:${escapeHtml(mobileHeaderText)};min-height:100%;display:flex;flex-direction:column;">${mobileMenuItemsHtml}${mobileFeaturedHtml}${mobileAccountHtml}${mobileContactHtml}${mobileSocialHtml}</div>`;

    // === MARKETING PIXELS (deferred injection) ===
    const marketingScripts = generateMarketingPixelScripts(marketingConfig);
    
    // === NEWSLETTER POPUP ===
    const newsletterPopupHtml = generateNewsletterPopupHtml(newsletterPopup, tenantId, route.type);
    
    // === CONSENT BANNER (LGPD) ===
    const consentBannerHtml = marketingConfig?.consent_mode_enabled ? generateConsentBannerHtml() : '';

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
      mobileSearchHtml,
      mobileBgColor: mobileHeaderBg,
      mobileTextColor: mobileHeaderText,
      marketingScripts,
      newsletterPopupHtml,
      consentBannerHtml,
      benefitEnabled: !!benefitConfig?.enabled,
      benefitThreshold,
      benefitMode: benefitConfig?.mode || 'free_shipping',
      benefitRewardLabel: benefitConfig?.rewardLabel || 'Frete Grátis',
      benefitSuccessLabel: benefitConfig?.successLabel || 'Você ganhou frete grátis!',
      benefitProgressColor: benefitConfig?.progressColor || '#22c55e',
    });

    console.log(`[storefront-html] ${route.type}${route.slug ? '/' + route.slug : ''} rendered in ${totalMs}ms (resolve=${resolveMs}ms, queries=${queryMs}ms)`);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200, max-age=120',
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
