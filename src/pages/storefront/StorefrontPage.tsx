// =============================================
// STOREFRONT PAGE - Public institutional page via Builder
// =============================================

import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { supabase } from '@/integrations/supabase/client';
import { CategorySettings } from '@/hooks/usePageSettings';

export default function StorefrontPage() {
  const tenantSlug = useTenantSlug();
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, categories: allCategories, isPublished, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  
  // Fetch category settings for product blocks
  const defaultCategorySettings: CategorySettings = {
    showCategoryName: true,
    showBanner: true,
    showRatings: true,
    showAddToCartButton: true,
    quickBuyEnabled: false,
    showBadges: true,
    buyNowButtonText: 'Comprar agora',
    customButtonEnabled: false,
    customButtonText: '',
    customButtonColor: '',
    customButtonLink: '',
  };

  const { data: categorySettings } = useQuery({
    queryKey: ['category-settings-published', tenantSlug, isPreviewMode],
    queryFn: async () => {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug || '')
        .single();
      
      if (!tenantData) return defaultCategorySettings;
      
      const { data: storeSettingsData } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenantData.id)
        .maybeSingle();
      
      const templateSetId = storeSettingsData?.published_template_id;
      
      if (!templateSetId) {
        const { data } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenantData.id)
          .eq('page_type', 'category')
          .maybeSingle();
        
        const overrides = data?.page_overrides as Record<string, unknown> | null;
        const saved = (overrides?.categorySettings as CategorySettings) || {};
        return { ...defaultCategorySettings, ...saved };
      }
      
      const contentField = isPreviewMode ? 'draft_content' : 'published_content';
      const { data: templateSet } = await supabase
        .from('storefront_template_sets')
        .select(contentField)
        .eq('id', templateSetId)
        .eq('tenant_id', tenantData.id)
        .single();
      
      if (!templateSet) return defaultCategorySettings;
      
      const content = (templateSet as any)[contentField] as Record<string, unknown> | null;
      const themeSettings = content?.themeSettings as Record<string, unknown> | undefined;
      const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
      const saved = (pageSettings?.category as CategorySettings) || {};
      
      return { ...defaultCategorySettings, ...saved };
    },
    enabled: !!tenantSlug,
  });
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicPage = usePublicPageTemplate(tenantSlug || '', pageSlug || '');
  const previewPage = usePreviewPageTemplate(tenantSlug || '', pageSlug || '');
  
  // Select appropriate data based on mode
  const pageData = isPreviewMode ? previewPage : publicPage;

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in pageData ? Boolean(pageData.canPreview) : true) 
    : true;

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

  // Redirect to public URL if preview mode is requested but user can't access preview
  useEffect(() => {
    if (isPreviewMode && !canPreview && !pageData.isLoading) {
      const basePath = getStoreBaseUrl(tenantSlug || '');
      const cleanPath = `${basePath}/page/${pageSlug}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath, { replace: true });
    }
  }, [isPreviewMode, canPreview, pageData.isLoading, tenantSlug, pageSlug, searchParams, navigate]);

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
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'institutional',
    // Pass categorySettings for any product blocks on institutional pages
    categorySettings: categorySettings || defaultCategorySettings,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      // NOTE: primary_color removed - colors managed via Configuração do tema > Cores
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
      parent_id: item.parent_id,
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
    // Individual page content for PageContent block (used in template-based pages)
    pageContent: pageData.individualContent || undefined,
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
