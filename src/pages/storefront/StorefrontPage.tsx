// =============================================
// STOREFRONT PAGE - Public institutional page via Builder
// =============================================

import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicPageTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewPageTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext } from '@/lib/builder/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getEffectiveSeo, applySeoToDocument } from '@/lib/seo';
import { getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';

export default function StorefrontPage() {
  const tenantSlug = useTenantSlug();
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, categories: allCategories, isPublished, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicPage = usePublicPageTemplate(tenantSlug || '', pageSlug || '');
  const previewPage = usePreviewPageTemplate(tenantSlug || '', pageSlug || '');
  
  // Select appropriate data based on mode
  const pageData = isPreviewMode ? previewPage : publicPage;

  // Apply SEO meta tags (only for public pages with SEO fields)
  useEffect(() => {
    if (!pageData.isLoading && pageData.content && 'metaTitle' in pageData) {
      const currentUrl = window.location.href;
      const seo = getEffectiveSeo(
        {
          metaTitle: pageData.metaTitle,
          metaDescription: pageData.metaDescription,
          metaImageUrl: pageData.metaImageUrl,
          noIndex: pageData.noIndex,
          canonicalUrl: pageData.canonicalUrl,
          title: pageData.pageTitle || undefined,
          type: pageData.pageType,
        },
        {
          storeName: storeSettings?.store_name,
          storeDescription: storeSettings?.store_description,
          logoUrl: storeSettings?.logo_url,
        },
        currentUrl
      );
      applySeoToDocument(seo);
    }
  }, [pageData, storeSettings]);

  // Loading state
  if (pageData.isLoading || storeLoading) {
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

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in pageData ? Boolean(pageData.canPreview) : true) 
    : true;

  // Redirect to public URL if preview mode is requested but user can't access preview
  useEffect(() => {
    if (isPreviewMode && !canPreview && !pageData.isLoading) {
      const basePath = tenantSlug ? `/store/${tenantSlug}/page/${pageSlug}` : `/page/${pageSlug}`;
      const cleanPath = `${basePath}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath, { replace: true });
    }
  }, [isPreviewMode, canPreview, pageData.isLoading, tenantSlug, pageSlug, searchParams, navigate]);

  // Page not found - show 404, never redirect to home
  if (!pageData.content && !pageData.isLoading) {
    return (
      <Storefront404 
        tenantSlug={tenantSlug || ''} 
        entityType="page" 
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
    categories: allCategories?.map(c => ({ id: c.id, slug: c.slug })),
    // Page-specific context
    page: {
      title: pageData.pageTitle || '',
      slug: pageSlug || '',
    },
  };

  return (
    <PublicTemplateRenderer
      content={pageData.content!}
      context={context}
      isLoading={false}
      error={pageData.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="institutional"
      pageId={pageData.pageId}
    />
  );
}
