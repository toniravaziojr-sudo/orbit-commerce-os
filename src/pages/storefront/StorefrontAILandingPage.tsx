// =============================================
// STOREFRONT AI LANDING PAGE - Serves AI-generated landing pages
// Fetches from ai_landing_pages table and renders generated HTML
// Resolves tenant from hostname (custom domain or platform subdomain)
// Injects marketing pixels (Meta/Google/TikTok) into generated HTML
// =============================================

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/NotFound';
import { isPlatformSubdomain, extractTenantFromPlatformSubdomain } from '@/lib/canonicalDomainService';
import { usePublicMarketingConfig } from '@/hooks/useMarketingIntegrations';

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
 * Inject pixel scripts into the AI LP HTML before </head> or </body>
 */
function injectPixelsIntoHtml(html: string, pixelScripts: string): string {
  if (!pixelScripts) return html;

  // Try to inject before </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${pixelScripts}\n</head>`);
  }
  // Fallback: inject before </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelScripts}\n</body>`);
  }
  // Last resort: append
  return html + pixelScripts;
}

export default function StorefrontAILandingPage() {
  const { lpSlug } = useParams<{ lpSlug: string }>();
  const { data: tenantInfo, isLoading: tenantLoading } = useTenantFromHostname();

  // Fetch marketing config for pixel injection
  const { data: marketingConfig } = usePublicMarketingConfig(tenantInfo?.tenantId);

  const { data: landingPage, isLoading: pageLoading, error } = useQuery({
    queryKey: ['ai-landing-page-public', tenantInfo?.tenantId, lpSlug],
    queryFn: async () => {
      if (!tenantInfo?.tenantId || !lpSlug) return null;

      // Get the AI landing page - must be published
      const { data: page, error: pageError } = await supabase
        .from('ai_landing_pages')
        .select('id, name, slug, generated_html, generated_css, seo_title, seo_description, seo_image_url, is_published')
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

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

  // Inject pixel scripts into the generated HTML
  const pixelScripts = buildPixelScripts(marketingConfig ?? null);
  const fullHtml = injectPixelsIntoHtml(landingPage.generated_html, pixelScripts);

  // Set document title
  if (typeof document !== 'undefined') {
    document.title = landingPage.seo_title || landingPage.name;
  }

  return (
    <div className="min-h-screen w-full" style={{ margin: 0, padding: 0 }}>
      <iframe
        srcDoc={fullHtml}
        className="w-full border-0"
        style={{ 
          minHeight: '100vh', 
          width: '100%', 
          display: 'block',
          border: 'none',
        }}
        title={landingPage.name}
      />
    </div>
  );
}
