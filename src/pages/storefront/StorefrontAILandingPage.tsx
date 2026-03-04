// =============================================
// STOREFRONT AI LANDING PAGE - Serves AI-generated landing pages
// V5: Supports generated_blocks (React components) with HTML fallback
// =============================================

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/NotFound';
import { isPlatformSubdomain, extractTenantFromPlatformSubdomain } from '@/lib/canonicalDomainService';
import { sanitizeAILandingPageHtml } from '@/lib/sanitizeAILandingPageHtml';
import { buildDocumentShell } from '@/lib/aiLandingPageShell';
import { usePublicMarketingConfig } from '@/hooks/useMarketingIntegrations';
import { CartProvider } from '@/contexts/CartContext';
import { DiscountProvider } from '@/contexts/DiscountContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { StorefrontThemeInjector } from '@/components/storefront/StorefrontThemeInjector';
import { TenantSlugContext } from '@/components/storefront/TenantStorefrontLayout';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { useEffect, useRef, useState, useMemo } from 'react';

interface AILandingPageData {
  id: string;
  name: string;
  slug: string;
  generated_html: string | null;
  generated_css: string | null;
  generated_blocks: BlockNode | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_url: string | null;
  is_published: boolean;
  show_header: boolean;
  show_footer: boolean;
}

/**
 * Resolves tenant ID from the current hostname
 */
function useTenantFromHostname() {
  const { tenantSlug: paramSlug } = useParams<{ tenantSlug: string }>();
  
  return useQuery({
    queryKey: ['tenant-from-hostname', window.location.hostname, paramSlug],
    queryFn: async () => {
      const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
      
      if (paramSlug) {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, slug')
          .eq('slug', paramSlug)
          .maybeSingle();
        if (error || !data) return null;
        return { tenantId: data.id, tenantSlug: data.slug };
      }
      
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
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}

/**
 * Build pixel injection scripts
 */
function buildPixelScripts(config: {
  meta_pixel_id?: string | null;
  meta_enabled?: boolean;
  google_measurement_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_ads_conversion_label?: string | null;
  google_enabled?: boolean;
  tiktok_pixel_id?: string | null;
  tiktok_enabled?: boolean;
} | null): string {
  if (!config) return '';
  const scripts: string[] = [];

  if (config.meta_enabled && config.meta_pixel_id) {
    scripts.push(`<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${config.meta_pixel_id}');fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${config.meta_pixel_id}&ev=PageView&noscript=1"/></noscript>`);
  }

  if (config.google_enabled && config.google_measurement_id) {
    scripts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${config.google_measurement_id}"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${config.google_measurement_id}');
${config.google_ads_conversion_id ? `gtag('config','${config.google_ads_conversion_id}');` : ''}
</script>`);
  }

  if (config.tiktok_enabled && config.tiktok_pixel_id) {
    scripts.push(`<script>
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
 * Build favicon link tag
 */
function buildFaviconTag(faviconUrl: string | null | undefined): string {
  if (!faviconUrl) return '';
  return `<link rel="icon" href="${faviconUrl}" type="image/png">`;
}

export default function StorefrontAILandingPage() {
  const { lpSlug, tenantSlug } = useParams<{ lpSlug: string; tenantSlug: string }>();
  const { data: tenantInfo, isLoading: tenantLoading } = useTenantFromHostname();

  const { data: marketingConfig } = usePublicMarketingConfig(tenantInfo?.tenantId);

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

  const { data: landingPage, isLoading: pageLoading } = useQuery({
    queryKey: ['ai-landing-page-public', tenantInfo?.tenantId, lpSlug],
    queryFn: async () => {
      if (!tenantInfo?.tenantId || !lpSlug) return null;
      const { data: page, error: pageError } = await supabase
        .from('ai_landing_pages')
        .select('id, name, slug, generated_html, generated_css, generated_blocks, seo_title, seo_description, seo_image_url, is_published, show_header, show_footer')
        .eq('tenant_id', tenantInfo.tenantId)
        .eq('slug', lpSlug)
        .eq('is_published', true)
        .maybeSingle();
      if (pageError) {
        console.error('Error fetching AI landing page:', pageError);
        return null;
      }
      return page as unknown as AILandingPageData | null;
    },
    enabled: !!tenantInfo?.tenantId && !!lpSlug,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  // V4.2: Skeleton + opacity transition for iframe loading (HTML fallback only)
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ai-lp-resize' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height);
        setIframeReady(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Fallback timeout: show iframe after 5s even without postMessage
  useEffect(() => {
    if (iframeReady) return;
    const timeout = setTimeout(() => {
      setIframeReady(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [iframeReady]);

  // Loading state
  if (tenantLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-screen w-full" />
      </div>
    );
  }

  // V5: Check for blocks OR HTML
  const hasBlocks = landingPage?.generated_blocks && 
    (landingPage.generated_blocks as any)?.children?.length > 0;
  const hasHtml = !!landingPage?.generated_html;

  if (!tenantInfo || !landingPage || (!hasBlocks && !hasHtml)) {
    return <NotFound />;
  }

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

  const resolvedTenantSlug = tenantSlug || tenantInfo.tenantSlug || '';

  // ===== V5: BLOCKS RENDERING (React components via BlockRenderer) =====
  if (hasBlocks) {
    const blockContent = landingPage.generated_blocks as BlockNode;
    const shouldShowHeader = landingPage.show_header ?? false;
    const shouldShowFooterV5 = landingPage.show_footer ?? false;
    
    // Filter out Header/Footer blocks from the tree - managed externally
    const contentChildren = (blockContent.children || []).filter(
      (node: BlockNode) => node.type !== 'Header' && node.type !== 'Footer'
    );

    const pageBg = (blockContent.props?.backgroundColor as string) || 'transparent';

    const blockContext: BlockRenderContext = {
      tenantSlug: resolvedTenantSlug,
      isPreview: false,
      pageType: 'landing_page',
    };

    return (
      <TenantSlugContext.Provider value={resolvedTenantSlug}>
        <CartProvider tenantSlug={resolvedTenantSlug}>
          <DiscountProvider>
            <StorefrontConfigProvider tenantId={tenantInfo.tenantId}>
              <StorefrontThemeInjector tenantSlug={resolvedTenantSlug} />
              <div className="w-full min-h-screen" style={{ margin: 0, padding: 0, isolation: 'isolate', backgroundColor: pageBg === 'transparent' ? undefined : pageBg }}>
                {shouldShowHeader && (
                  <div style={{ containerType: 'inline-size', containerName: 'storefront' }} className="storefront-header-wrapper">
                    <StorefrontHeader key={`header-${resolvedTenantSlug}`} />
                  </div>
                )}
                {contentChildren.map((node: BlockNode) => (
                  <BlockRenderer
                    key={node.id}
                    node={node}
                    context={blockContext}
                    isEditing={false}
                  />
                ))}
                {shouldShowFooterV5 && (
                  <div style={{ containerType: 'inline-size', containerName: 'storefront' }} className="storefront-footer-wrapper">
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

  // ===== LEGACY HTML FALLBACK (iframe) =====
  const pixelScripts = buildPixelScripts(marketingConfig ?? null);
  const faviconTag = buildFaviconTag(storeSettings?.favicon_url);
  const sanitizedHtml = sanitizeAILandingPageHtml(landingPage.generated_html!);
  const fullHtml = buildDocumentShell(sanitizedHtml, {
    pixelScripts,
    faviconTag,
  });

  const shouldShowHeader = landingPage.show_header ?? false;
  const shouldShowFooter = landingPage.show_footer ?? false;

  // V4.2: Skeleton container + opacity transition
  const iframeStyle: React.CSSProperties = {
    width: '100%',
    display: 'block',
    border: 'none',
    height: iframeHeight ? `${iframeHeight}px` : 'auto',
    minHeight: '400px',
    maxHeight: iframeHeight ? `${iframeHeight}px` : undefined,
    overflow: 'hidden',
    opacity: iframeReady ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
  };

  const skeletonOverlay = !iframeReady ? (
    <div className="absolute inset-0 flex items-center justify-center" style={{ minHeight: '400px' }}>
      <div className="w-full max-w-3xl space-y-6 px-8">
        <Skeleton className="h-10 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-48 mx-auto rounded-full" />
      </div>
    </div>
  ) : null;

  const iframeElement = (
    <div className="relative" style={{ minHeight: '400px' }}>
      {skeletonOverlay}
      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        className="w-full border-0"
        style={iframeStyle}
        title={landingPage.name}
        scrolling="no"
      />
    </div>
  );

  if (shouldShowHeader || shouldShowFooter) {
    return (
      <TenantSlugContext.Provider value={resolvedTenantSlug}>
        <CartProvider tenantSlug={resolvedTenantSlug}>
          <DiscountProvider>
            <StorefrontConfigProvider tenantId={tenantInfo.tenantId}>
              <StorefrontThemeInjector tenantSlug={resolvedTenantSlug} />
              <div className="w-full min-h-screen bg-white" style={{ margin: 0, padding: 0, isolation: 'isolate' }}>
                {shouldShowHeader && (
                  <div style={{ containerType: 'inline-size', containerName: 'storefront' }} className="storefront-header-wrapper">
                    <StorefrontHeader key={`header-${resolvedTenantSlug}`} />
                  </div>
                )}
                {iframeElement}
                {shouldShowFooter && (
                  <div style={{ containerType: 'inline-size', containerName: 'storefront' }} className="storefront-footer-wrapper">
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

  return (
    <div className="min-h-screen w-full" style={{ margin: 0, padding: 0 }}>
      {iframeElement}
    </div>
  );
}
