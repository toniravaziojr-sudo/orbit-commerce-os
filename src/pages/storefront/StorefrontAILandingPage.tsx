// =============================================
// STOREFRONT AI LANDING PAGE - Serves AI-generated landing pages
// Fetches from ai_landing_pages table and renders generated HTML
// Resolves tenant from hostname (custom domain or platform subdomain)
// =============================================

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/NotFound';
import { isPlatformSubdomain, extractTenantFromPlatformSubdomain } from '@/lib/canonicalDomainService';

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

export default function StorefrontAILandingPage() {
  const { lpSlug } = useParams<{ lpSlug: string }>();
  const { data: tenantInfo, isLoading: tenantLoading } = useTenantFromHostname();

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

  // Render the full HTML page
  const fullHtml = landingPage.generated_html;

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
