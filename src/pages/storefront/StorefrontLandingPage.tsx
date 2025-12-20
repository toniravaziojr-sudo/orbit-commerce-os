// =============================================
// STOREFRONT LANDING PAGE - Public landing page via Builder
// Filters by type = 'landing_page' for security
// =============================================

import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { useAuth } from '@/hooks/useAuth';
import { useTenantSlug } from '@/hooks/useTenantSlug';

// Hook specifically for landing pages - validates type = 'landing_page'
// Supports preview mode for unpublished pages when user is authenticated
function usePublicLandingPage(tenantSlug: string, pageSlug: string, isPreviewMode: boolean) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['public-landing-page', tenantSlug, pageSlug, isPreviewMode, user?.id],
    queryFn: async () => {
      // Get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Get the page - MUST be type = 'landing_page'
      const { data: page, error: pageError } = await supabase
        .from('store_pages')
        .select('id, title, published_version, draft_version, is_published, content, type')
        .eq('tenant_id', tenant.id)
        .eq('slug', pageSlug)
        .eq('type', 'landing_page') // Critical: only landing pages
        .maybeSingle();

      if (pageError) {
        throw pageError;
      }

      // Page not found or wrong type
      if (!page) {
        return null;
      }

      // In preview mode, check if user has access to this tenant
      if (isPreviewMode && user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant.id)
          .maybeSingle();
        
        // User has access - use draft version first
        if (userRole) {
          const versionToUse = page.draft_version || page.published_version;
          
          if (versionToUse) {
            const { data: version, error: versionError } = await supabase
              .from('store_page_versions')
              .select('content')
              .eq('tenant_id', tenant.id)
              .eq('entity_type', 'page')
              .eq('page_id', page.id)
              .eq('version', versionToUse)
              .maybeSingle();

            if (!versionError && version) {
              return {
                content: version.content as unknown as BlockNode,
                pageTitle: page.title,
                pageId: page.id,
              };
            }
          }
          
          // Fallback to content field
          if (page.content && typeof page.content === 'object' && 'type' in (page.content as object)) {
            return {
              content: page.content as unknown as BlockNode,
              pageTitle: page.title,
              pageId: page.id,
            };
          }

          return {
            content: getDefaultTemplate('institutional'),
            pageTitle: page.title,
            pageId: page.id,
          };
        }
      }

      // Public access - Page must be published
      if (!page.is_published) {
        return null; // Return null instead of throwing to show proper 404
      }

      // If has published version, use it
      if (page.published_version) {
        const { data: version, error: versionError } = await supabase
          .from('store_page_versions')
          .select('content')
          .eq('tenant_id', tenant.id)
          .eq('entity_type', 'page')
          .eq('page_id', page.id)
          .eq('version', page.published_version)
          .eq('status', 'published')
          .maybeSingle();

        if (!versionError && version) {
          return {
            content: version.content as unknown as BlockNode,
            pageTitle: page.title,
            pageId: page.id,
          };
        }
      }

      // Fallback to content field or default template
      if (page.content && typeof page.content === 'object' && 'type' in (page.content as object)) {
        return {
          content: page.content as unknown as BlockNode,
          pageTitle: page.title,
          pageId: page.id,
        };
      }

      return {
        content: getDefaultTemplate('institutional'),
        pageTitle: page.title,
        pageId: page.id,
      };
    },
    enabled: !!tenantSlug && !!pageSlug,
    staleTime: 1000 * 60 * 5,
  });
}

export default function StorefrontLandingPage() {
  const tenantSlug = useTenantSlug();
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, categories, isPublished, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const { data: pageData, isLoading: pageLoading, error } = usePublicLandingPage(tenantSlug || '', pageSlug || '', isPreviewMode);

  // Loading state
  if (pageLoading || storeLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-16 w-full" />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // Store not published (and not in preview mode)
  if (!isPreviewMode && !isPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <FileX className="h-4 w-4" />
          <AlertTitle>Loja não disponível</AlertTitle>
          <AlertDescription>
            Esta loja não está publicada no momento.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Page not found (either doesn't exist or is not a landing page) - show 404, never redirect
  if (!pageData) {
    return (
      <Storefront404 
        tenantSlug={tenantSlug || ''} 
        entityType="landing" 
        entitySlug={pageSlug}
      />
    );
  }

  // Build context for block rendering
  const context: BlockRenderContext & { categories?: any[] } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
      social_instagram: storeSettings?.social_instagram || undefined,
      social_facebook: storeSettings?.social_facebook || undefined,
      social_whatsapp: storeSettings?.social_whatsapp || undefined,
      store_description: storeSettings?.store_description || undefined,
      contact_phone: storeSettings?.contact_phone,
      contact_email: storeSettings?.contact_email,
      tenant_id: storeSettings?.tenant_id,
    } as any,
    headerMenu: headerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
      item_type: item.item_type,
      ref_id: item.ref_id || undefined,
      sort_order: item.sort_order,
    })) as any,
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    categories: categories?.map(c => ({ id: c.id, slug: c.slug })),
    page: {
      title: pageData.pageTitle || '',
      slug: pageSlug || '',
    },
  };

  return (
    <PublicTemplateRenderer
      content={pageData.content}
      context={context}
      isLoading={false}
      error={error}
      isPreviewMode={isPreviewMode}
      canPreview={true}
      pageType="landing_page"
      pageId={pageData.pageId}
    />
  );
}
