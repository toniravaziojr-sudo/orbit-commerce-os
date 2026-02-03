// =============================================
// STOREFRONT AI LANDING PAGE - Serves AI-generated landing pages
// Fetches from ai_landing_pages table and renders generated HTML
// =============================================

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/NotFound';

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

export default function StorefrontAILandingPage() {
  const tenantSlug = useTenantSlug();
  const { lpSlug } = useParams<{ lpSlug: string }>();

  const { data: landingPage, isLoading, error } = useQuery({
    queryKey: ['ai-landing-page-public', tenantSlug, lpSlug],
    queryFn: async () => {
      if (!tenantSlug || !lpSlug) return null;

      // Get tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (tenantError || !tenant) {
        console.error('Tenant not found:', tenantSlug);
        return null;
      }

      // Get the AI landing page - must be published
      const { data: page, error: pageError } = await supabase
        .from('ai_landing_pages')
        .select('id, name, slug, generated_html, generated_css, seo_title, seo_description, seo_image_url, is_published')
        .eq('tenant_id', tenant.id)
        .eq('slug', lpSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (pageError) {
        console.error('Error fetching AI landing page:', pageError);
        return null;
      }

      return page as AILandingPageData | null;
    },
    enabled: !!tenantSlug && !!lpSlug,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-screen w-full" />
      </div>
    );
  }

  // Not found or not published
  if (!landingPage || !landingPage.generated_html) {
    return <NotFound />;
  }

  // Render the full HTML page
  // Since this is a self-contained HTML, we render it in an iframe for isolation
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
