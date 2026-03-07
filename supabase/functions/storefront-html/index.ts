// ============================================
// STOREFRONT HTML — Edge-Rendered Storefront
// v8.1.0: Category + Product routes use compileBlockTree(published_content) — full parity
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

// ===== VERSION =====
const VERSION = "v8.1.0"; // Category + Product routes use compileBlockTree(published_content)
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
  stylesheetTags: string;
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
  
  const preloadTags = `<link rel="preload" href="${cssUrl}" as="style">`;
  
  const stylesheetTags = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="${cssUrl}" rel="stylesheet">`,
  ].join('\n  ');
  
  return { stylesheetTags, preloadTags };
}

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
  
  const productMatch = clean.match(/^produto\/(.+)$/);
  if (productMatch) return { type: 'product', slug: productMatch[1] };
  
  const categoryMatch = clean.match(/^categoria\/(.+)$/);
  if (categoryMatch) return { type: 'category', slug: categoryMatch[1] };
  
  const pageMatch = clean.match(/^p\/(.+)$/);
  if (pageMatch) return { type: 'page', slug: pageMatch[1] };

  const blogPostMatch = clean.match(/^blog\/(.+)$/);
  if (blogPostMatch) return { type: 'blog_post', slug: blogPostMatch[1] };

  if (clean === 'blog') return { type: 'blog_index' };
  
  const knownRoutes = ['carrinho', 'checkout', 'obrigado', 'rastreio', 'minha-conta'];
  if (knownRoutes.some(r => clean === r || clean.startsWith(r + '/'))) {
    return { type: 'unknown' };
  }
  
  return { type: 'page', slug: clean };
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
  <nav class="sf-mobile-nav" data-sf-mobile-nav>
    <button style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;" data-sf-action="toggle-mobile-menu">&times;</button>
    ${opts.navItemsHtml || ''}
  </nav>

  <!-- Cart Drawer -->
  <div class="sf-cart-backdrop" data-sf-cart-backdrop></div>
  <div class="sf-cart-drawer" data-sf-cart-drawer>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee;">
      <h3 style="font-size:16px;font-weight:600;">Seu Carrinho</h3>
      <button data-sf-action="toggle-cart" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
    </div>
    <div data-sf-cart-items style="flex:1;overflow-y:auto;padding:16px 20px;"></div>
    <div style="padding:16px 20px;border-top:1px solid #eee;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="font-weight:600;">Total:</span>
        <span data-sf-cart-total style="font-weight:700;font-size:18px;">R$ 0,00</span>
      </div>
      <a href="/carrinho" style="display:block;width:100%;padding:12px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);text-align:center;border-radius:8px;font-weight:600;text-decoration:none;">Ver Carrinho</a>
    </div>
  </div>

  <script>
    (function(){
      var TENANT="${escapeHtml(opts.tenantSlug)}";
      var HOSTNAME="${escapeHtml(opts.hostname)}";
      var CART_KEY="storefront_cart_"+TENANT;
      var cart=JSON.parse(localStorage.getItem(CART_KEY)||"[]");

      function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(cart));updateCartUI();}

      function updateCartUI(){
        var total=cart.reduce(function(s,i){return s+i.price*i.quantity},0);
        var count=cart.reduce(function(s,i){return s+i.quantity},0);
        document.querySelectorAll("[data-sf-cart-count]").forEach(function(el){
          el.textContent=count;el.style.display=count>0?"flex":"none";
        });
        var totalEl=document.querySelector("[data-sf-cart-total]");
        if(totalEl)totalEl.textContent="R$ "+total.toFixed(2).replace(".",",");
        var itemsEl=document.querySelector("[data-sf-cart-items]");
        if(itemsEl){
          if(cart.length===0){itemsEl.innerHTML='<p style="text-align:center;color:#999;padding:32px 0;">Carrinho vazio</p>';return;}
          itemsEl.innerHTML=cart.map(function(item,idx){
            return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f5f5f5;"><div style="width:60px;height:60px;border-radius:6px;overflow:hidden;background:#f5f5f5;flex-shrink:0;">'+(item.image?'<img src="'+item.image+'" style="width:100%;height:100%;object-fit:cover;">':'')+'</div><div style="flex:1;min-width:0;"><p style="font-size:13px;font-weight:500;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+item.name+'</p><p style="font-size:14px;font-weight:600;">R$ '+(item.price*item.quantity).toFixed(2).replace(".",",")+'</p><p style="font-size:12px;color:#666;">Qtd: '+item.quantity+'</p></div><button data-sf-action="remove-cart-item" data-index="'+idx+'" style="background:none;border:none;color:#999;cursor:pointer;font-size:18px;padding:4px;">&times;</button></div>';
          }).join("");
        }
      }

      function addToCart(id,name,price,image,variantId){
        var existing=cart.find(function(i){return i.product_id===id&&(i.variant_id||"")===(variantId||"")});
        if(existing){existing.quantity++;}else{
          cart.push({id:id+"_"+(variantId||"default")+"_"+Date.now(),product_id:id,variant_id:variantId||null,name:name,sku:"",price:parseFloat(price),quantity:1,image:image||""});
        }
        saveCart();
        document.querySelector("[data-sf-cart-drawer]")?.classList.add("active");
        document.querySelector("[data-sf-cart-backdrop]")?.classList.add("active");
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

      // Event delegation
      document.addEventListener("click",function(e){
        var btn=e.target.closest("[data-sf-action]");
        if(!btn)return;
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
          for(var q2=0;q2<qty2;q2++) addToCart(btn.dataset.productId, btn.dataset.productName, parseFloat(btn.dataset.productPrice), btn.dataset.productImage, btn.dataset.variantId);
          window.location.href="/checkout";
        } else if(action==="remove-cart-item"){
          var idx = parseInt(btn.dataset.index);
          cart.splice(idx,1); saveCart();
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
        }
      });

      // CEP mask
      var cepEl=document.querySelector("[data-sf-shipping-cep]");
      if(cepEl)cepEl.addEventListener("input",function(){var v=this.value.replace(/\D/g,"");if(v.length>5)v=v.slice(0,5)+"-"+v.slice(5,8);else v=v.slice(0,8);this.value=v;});

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
                gb.style.color="var(--theme-text-primary,#1a1a1a)";
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
        });
        if(lbClose)lbClose.addEventListener("click",lbHide);
        lightbox.addEventListener("click",function(e){if(e.target===lightbox)lbHide();});
        document.addEventListener("keydown",function(e){
          if(!lightbox.classList.contains("open"))return;
          if(e.key==="Escape")lbHide();
          if(e.key==="ArrowLeft"&&gallerySrcs.length>1)lbShow(lbCurrentIdx-1);
          if(e.key==="ArrowRight"&&gallerySrcs.length>1)lbShow(lbCurrentIdx+1);
          if(e.key==="+"||e.key==="=")lbSetZoom(lbZoom+0.25);
          if(e.key==="-")lbSetZoom(lbZoom-0.25);
        });
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
        });
      }
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
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600, max-age=60',
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
    
    // Base queries (all pages need these)
    const baseQueries = [
      supabase.from('tenants').select('id, name, slug, logo_url').eq('id', tenantId).maybeSingle(),
      supabase.from('store_settings').select('store_name, logo_url, store_description, social_instagram, social_facebook, social_whatsapp, social_tiktok, social_youtube, contact_phone, contact_email, contact_address, contact_support_hours, business_legal_name, business_cnpj, is_published, favicon_url, seo_title, seo_description').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('menus').select('*, menu_items(*)').eq('tenant_id', tenantId).eq('location', 'header').maybeSingle(),
      supabase.from('categories').select('id, name, slug').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order').limit(10),
      supabase.from('storefront_template_sets').select('id, published_content, is_published, base_preset').eq('tenant_id', tenantId).eq('is_published', true).maybeSingle(),
      supabase.from('storefront_global_layout').select('header_config, published_header_config, footer_config, published_footer_config, header_enabled, footer_enabled').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('menus').select('id, name, location, menu_items(id, label, url, item_type, ref_id, sort_order)').eq('tenant_id', tenantId).in('location', ['footer', 'footer_1', 'footer_2']),
    ];

    // Route-specific queries
    const routeQueries: Promise<any>[] = [];
    if (route.type === 'product' && route.slug) {
      routeQueries.push(
        supabase.from('products')
          .select('id, name, slug, sku, price, compare_at_price, description, short_description, brand, stock_quantity, status, free_shipping, seo_title, seo_description, has_variants, tags, avg_rating, review_count, allow_backorder')
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
    const footerMenusRaw = allResults[6].status === 'fulfilled' ? (allResults[6] as any).value.data || [] : [];

    // Build footer menus structure
    const footer1Menu = footerMenusRaw.find((m: any) => m.location === 'footer_1' || m.location === 'footer');
    const footer2Menu = footerMenusRaw.find((m: any) => m.location === 'footer_2');
    const footerMenus = {
      footer1: footer1Menu ? { name: footer1Menu.name, items: footer1Menu.menu_items || [] } : { name: '', items: [] },
      footer2: footer2Menu ? { name: footer2Menu.name, items: footer2Menu.menu_items || [] } : { name: '', items: [] },
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
      ? [...headerMenuRaw.menu_items].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
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
      const productResult = allResults[7];
      const product = productResult?.status === 'fulfilled' ? (productResult as any).value.data : null;

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
      const categoryResult = allResults[7];
      const category = categoryResult?.status === 'fulfilled' ? (categoryResult as any).value.data : null;

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

      // Use published_content.category block tree if available
      const categoryContent = publishedContent?.category as BlockNode | null;
      if (categoryContent) {
        bodyHtml = compileBlockTree(categoryContent, compilerContext);
        console.log(`[storefront-html][${VERSION}] Category compiled via compileBlockTree(published_content.category)`);
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
      const pageResult = allResults[7];
      const page = pageResult?.status === 'fulfilled' ? (pageResult as any).value.data : null;

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
      const postsResult = allResults[7];
      const posts = postsResult?.status === 'fulfilled' ? (postsResult as any).value.data || [] : [];

      bodyHtml = blogIndexToStaticHTML(posts, storeName);
      pageTitle = `Blog | ${storeName}`;
      pageDescription = `Confira as últimas novidades do ${storeName}`;
      canonicalPath = '/blog';

    } else if (route.type === 'blog_post' && route.slug) {
      // BLOG POST — using block-compiler
      const postResult = allResults[7];
      const post = postResult?.status === 'fulfilled' ? (postResult as any).value.data : null;

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

    } else {
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
