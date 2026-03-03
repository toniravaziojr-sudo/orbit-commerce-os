// =============================================
// STOREFRONT AI LANDING PAGE - Serves AI-generated landing pages
// Fetches from ai_landing_pages table and renders generated HTML
// Resolves tenant from hostname (custom domain or platform subdomain)
// Injects marketing pixels (Meta/Google/TikTok) into generated HTML
// Conditionally renders store header/footer based on show_header/show_footer
// =============================================

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/NotFound';
import { isPlatformSubdomain, extractTenantFromPlatformSubdomain } from '@/lib/canonicalDomainService';
import { sanitizeAILandingPageHtml } from '@/lib/sanitizeAILandingPageHtml';
import { usePublicMarketingConfig } from '@/hooks/useMarketingIntegrations';
import { CartProvider } from '@/contexts/CartContext';
import { DiscountProvider } from '@/contexts/DiscountContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { StorefrontThemeInjector } from '@/components/storefront/StorefrontThemeInjector';
import { TenantSlugContext } from '@/components/storefront/TenantStorefrontLayout';
import { useEffect, useRef, useState } from 'react';

interface AILandingPageData {
  id: string;
  name: string;
  slug: string;
  generated_html: string | null;
  generated_css: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_url: string | null;
  is_published: boolean;
  show_header: boolean;
  show_footer: boolean;
}

/**
 * Resolves tenant ID from the current hostname
 * Works for: custom domains, platform subdomains, and legacy /store/:tenantSlug routes
 */
function useTenantFromHostname() {
  const { tenantSlug: paramSlug } = useParams<{ tenantSlug: string }>();
  
  return useQuery({
    queryKey: ['tenant-from-hostname', window.location.hostname, paramSlug],
    queryFn: async () => {
      const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
      
      // 1. If URL has tenantSlug param (legacy /store/:tenantSlug route)
      if (paramSlug) {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, slug')
          .eq('slug', paramSlug)
          .maybeSingle();
        
        if (error || !data) return null;
        return { tenantId: data.id, tenantSlug: data.slug };
      }
      
      // 2. Check if it's a platform subdomain (tenant.shops.comandocentral.com.br)
      if (isPlatformSubdomain(hostname)) {
        const extractedSlug = extractTenantFromPlatformSubdomain(hostname);
        if (extractedSlug) {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, slug')
            .eq('slug', extractedSlug)
            .maybeSingle();
          
          if (error || !data) return null;
          return { tenantId: data.id, tenantSlug: data.slug };
        }
      }
      
      // 3. Custom domain - lookup in tenant_domains table
      const { data: domainData, error: domainError } = await supabase
        .from('tenant_domains')
        .select('tenant_id, tenants!inner(slug)')
        .eq('domain', hostname)
        .eq('status', 'verified')
        .maybeSingle();
      
      if (domainError || !domainData) {
        console.log('[AILandingPage] Domain not found:', hostname);
        return null;
      }
      
      return { 
        tenantId: domainData.tenant_id, 
        tenantSlug: (domainData.tenants as any)?.slug || '' 
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
  });
}

/**
 * Build pixel injection scripts to insert into the AI LP iframe HTML
 */
function buildPixelScripts(config: {
  meta_pixel_id?: string | null;
  meta_enabled?: boolean;
  google_measurement_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_enabled?: boolean;
  tiktok_pixel_id?: string | null;
  tiktok_enabled?: boolean;
} | null): string {
  if (!config) return '';

  const scripts: string[] = [];

  // Meta Pixel
  if (config.meta_enabled && config.meta_pixel_id) {
    scripts.push(`
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${config.meta_pixel_id}');fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${config.meta_pixel_id}&ev=PageView&noscript=1"/></noscript>`);
  }

  // Google Analytics / Ads
  if (config.google_enabled && config.google_measurement_id) {
    scripts.push(`
<script async src="https://www.googletagmanager.com/gtag/js?id=${config.google_measurement_id}"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${config.google_measurement_id}');
${config.google_ads_conversion_id ? `gtag('config','${config.google_ads_conversion_id}');` : ''}
</script>`);
  }

  // TikTok Pixel
  if (config.tiktok_enabled && config.tiktok_pixel_id) {
    scripts.push(`
<script>
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=
["page","track","identify","instances","debug","on","off","once","ready","alias",
"group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function()
{t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)
ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],
n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=
function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||
{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=
ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";
o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];
a.parentNode.insertBefore(o,a)};ttq.load('${config.tiktok_pixel_id}');ttq.page()}
(window,document,'ttq');
</script>`);
  }

  return scripts.join('\n');
}

/**
 * Build favicon link tag from tenant store settings
 */
function buildFaviconTag(faviconUrl: string | null | undefined): string {
  if (!faviconUrl) return '';
  return `<link rel="icon" href="${faviconUrl}" type="image/png">`;
}

/**
 * Inject pixel scripts and favicon into the AI LP HTML before </head> or </body>
 */
/**
 * Convert @import url(...) inside <style> tags to <link> tags to prevent render-blocking.
 * In srcDoc iframes, @import can block rendering indefinitely if the font fails to load.
 */
function convertImportsToLinks(html: string): string {
  const importRegex = /@import\s+url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)\s*;?/g;
  const links: string[] = [];
  
  // Extract @import URLs and remove them from <style>
  let result = html.replace(importRegex, (match, url) => {
    links.push(`<link rel="stylesheet" href="${url}">`);
    return ''; // Remove the @import from <style>
  });
  
  // Inject <link> tags in <head>
  if (links.length > 0 && result.includes('</head>')) {
    result = result.replace('</head>', `${links.join('\n')}\n</head>`);
  }
  
  return result;
}

function injectPixelsIntoHtml(html: string, pixelScripts: string, faviconTag?: string): string {
  // Auto-resize script — measures content once after stabilization, prevents vh feedback loop
  const autoResizeScript = `
<script>
(function(){
  var locked = false;
  var lastH = 0;
  var stableCount = 0;
  function sendHeight(){
    if(locked) return;
    try {
      var h = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0
      );
      if(h > 0 && Math.abs(h - lastH) > 2){
        stableCount = 0;
        lastH = h;
        window.parent.postMessage({type:'ai-lp-resize', height: h}, '*');
      } else if(h > 0) {
        stableCount++;
        if(stableCount >= 3) { locked = true; } // Lock after 3 stable readings
      }
    } catch(e){}
  }
  // Measure a few times to catch images/fonts loading
  sendHeight();
  setTimeout(sendHeight, 200);
  setTimeout(sendHeight, 600);
  setTimeout(sendHeight, 1500);
  setTimeout(sendHeight, 3000);
  // Watch for images loading (one-time)
  var imgs = document.querySelectorAll('img');
  imgs.forEach(function(img){
    if(!img.complete){ img.addEventListener('load', function(){ sendHeight(); }, {once:true}); }
  });
})();
</script>`;

  // First, convert @import to <link> to prevent render-blocking
  let result = convertImportsToLinks(html);

  // Safety CSS: force visibility — prevents opacity:0 stuck state from animation-fill-mode:both
  // The root cause: `animation: fadeInUp 0.8s ease-out 0.2s both` keeps elements at opacity:0
  // if animation keyframes are malformed or fail to complete in srcDoc iframes
  const visibilitySafety = `<style id="lp-safety">
    /* Kill CSS animations that cause opacity:0 stuck state */
    *, *::before, *::after { animation: none !important; }
    /* Force visibility on every element */
    * { opacity: 1 !important; visibility: visible !important; }
    /* Prevent vh feedback loop: cap min-height on sections inside auto-resized iframes */
    section, .section, .hero, [class*="hero"] {
      min-height: auto !important;
    }
    .cta-button { cursor: pointer; }
  </style>`;

  // Inject head items (favicon, pixels, visibility safety) before </head>
  const headInjections = [faviconTag, pixelScripts, visibilitySafety].filter(Boolean).join('\n');
  if (headInjections && result.includes('</head>')) {
    result = result.replace('</head>', `${headInjections}\n</head>`);
  }

  // Inject auto-resize script before </body> (so document.body exists)
  if (result.includes('</body>')) {
    result = result.replace('</body>', `${autoResizeScript}\n</body>`);
  } else if (result.includes('</html>')) {
    result = result.replace('</html>', `${autoResizeScript}\n</html>`);
  } else {
    result += autoResizeScript;
  }

  return result;
}

export default function StorefrontAILandingPage() {
  const { lpSlug, tenantSlug } = useParams<{ lpSlug: string; tenantSlug: string }>();
  const { data: tenantInfo, isLoading: tenantLoading } = useTenantFromHostname();

  // Fetch marketing config for pixel injection
  const { data: marketingConfig } = usePublicMarketingConfig(tenantInfo?.tenantId);

  // Fetch store settings for favicon
  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings-favicon', tenantInfo?.tenantId],
    queryFn: async () => {
      if (!tenantInfo?.tenantId) return null;
      const { data, error } = await supabase
        .from('store_settings')
        .select('favicon_url')
        .eq('tenant_id', tenantInfo.tenantId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!tenantInfo?.tenantId,
    staleTime: 1000 * 60 * 10,
  });

  const { data: landingPage, isLoading: pageLoading, error } = useQuery({
    queryKey: ['ai-landing-page-public', tenantInfo?.tenantId, lpSlug],
    queryFn: async () => {
      if (!tenantInfo?.tenantId || !lpSlug) return null;

      // Get the AI landing page - must be published - include show_header/show_footer
      const { data: page, error: pageError } = await supabase
        .from('ai_landing_pages')
        .select('id, name, slug, generated_html, generated_css, seo_title, seo_description, seo_image_url, is_published, show_header, show_footer')
        .eq('tenant_id', tenantInfo.tenantId)
        .eq('slug', lpSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (pageError) {
        console.error('Error fetching AI landing page:', pageError);
        return null;
      }

      return page as AILandingPageData | null;
    },
    enabled: !!tenantInfo?.tenantId && !!lpSlug,
    staleTime: 1000 * 30, // 30 seconds — ensures show_header/show_footer toggle reflects quickly
    refetchOnWindowFocus: true,
  });

  // Auto-resize iframe based on content height (hooks must be before conditionals)
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ai-lp-resize' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Loading state
  if (tenantLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-screen w-full" />
      </div>
    );
  }

  // Not found: tenant not resolved, page not found, or not published
  if (!tenantInfo || !landingPage || !landingPage.generated_html) {
    return <NotFound />;
  }

  // Inject pixel scripts and favicon into the generated HTML
  const pixelScripts = buildPixelScripts(marketingConfig ?? null);
  const faviconTag = buildFaviconTag(storeSettings?.favicon_url);
  const sanitizedHtml = sanitizeAILandingPageHtml(landingPage.generated_html);
  const fullHtml = injectPixelsIntoHtml(sanitizedHtml, pixelScripts, faviconTag);

  // Set document title and favicon on parent document
  if (typeof document !== 'undefined') {
    document.title = landingPage.seo_title || landingPage.name;
    if (storeSettings?.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = storeSettings.favicon_url;
      link.type = 'image/png';
    }
  }

  const shouldShowHeader = landingPage.show_header ?? false;
  const shouldShowFooter = landingPage.show_footer ?? false;
  const resolvedTenantSlug = tenantSlug || tenantInfo.tenantSlug || '';

  const iframeStyle: React.CSSProperties = {
    width: '100%',
    display: 'block',
    border: 'none',
    height: iframeHeight ? `${iframeHeight}px` : '80vh',
    minHeight: '400px',
    maxHeight: iframeHeight ? `${iframeHeight}px` : undefined,
    overflow: 'hidden',
  };

  // If header or footer needed, wrap with providers + TenantSlugContext + ThemeInjector
  if (shouldShowHeader || shouldShowFooter) {
    return (
      <TenantSlugContext.Provider value={resolvedTenantSlug}>
        <CartProvider tenantSlug={resolvedTenantSlug}>
          <DiscountProvider>
            <StorefrontConfigProvider tenantId={tenantInfo.tenantId}>
              <StorefrontThemeInjector tenantSlug={resolvedTenantSlug} />
              <div className="w-full min-h-screen bg-white" style={{ margin: 0, padding: 0, isolation: 'isolate' }}>
                {shouldShowHeader && (
                  <div style={{ containerType: 'inline-size' }} className="storefront-header-wrapper">
                    <StorefrontHeader key={`header-${resolvedTenantSlug}`} />
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  srcDoc={fullHtml}
                  className="w-full border-0"
                  style={iframeStyle}
                  title={landingPage.name}
                  scrolling="no"
                />
                {shouldShowFooter && (
                  <div style={{ containerType: 'inline-size' }} className="storefront-footer-wrapper">
                    <StorefrontFooter key={`footer-${resolvedTenantSlug}`} />
                  </div>
                )}
              </div>
            </StorefrontConfigProvider>
          </DiscountProvider>
        </CartProvider>
      </TenantSlugContext.Provider>
    );
  }

  // No header/footer — render standalone
  return (
    <div className="min-h-screen w-full" style={{ margin: 0, padding: 0 }}>
      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        className="w-full border-0"
        style={{
          ...iframeStyle,
          height: iframeHeight ? `${iframeHeight}px` : '100vh',
        }}
        title={landingPage.name}
        scrolling="no"
      />
    </div>
  );
}
