// =============================================
// STOREFRONT HOME - Public home page via Builder
// =============================================
// OPTIMIZED v2: Uses bootstrap data for template, categorySettings, globalLayout
// Eliminates ~10 duplicate queries → 1 single bootstrap call

import { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { CategorySettings } from '@/hooks/usePageSettings';

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

export default function StorefrontHome() {
  const tenantSlug = useTenantSlug();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';

  // SINGLE bootstrap call - provides ALL data including template, globalLayout, categorySettings
  const { 
    tenant, storeSettings, headerMenu, footerMenu, categories, 
    isPublished, isLoading: storeLoading,
    globalLayout: bootstrapGlobalLayout,
    pageOverrides: bootstrapPageOverrides,
    categorySettings: bootstrapCategorySettings,
    template: bootstrapTemplate,
  } = usePublicStorefront(tenantSlug || '');

  // Derive template content from bootstrap (no extra queries!)
  const templateContent = useMemo<BlockNode>(() => {
    if (!bootstrapTemplate?.published_content) return getDefaultTemplate('home');
    const content = bootstrapTemplate.published_content as Record<string, BlockNode | null>;
    return content?.home || getDefaultTemplate('home');
  }, [bootstrapTemplate]);

  // Merge category settings from bootstrap
  const categorySettings = useMemo(() => {
    return { ...defaultCategorySettings, ...(bootstrapCategorySettings || {}) };
  }, [bootstrapCategorySettings]);

  // Use preview hook ONLY in preview mode (separate queries are acceptable for preview)
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'home');
  
  // In normal mode, use bootstrap data. In preview mode, use preview hook.
  const content = isPreviewMode ? previewTemplate.content : templateContent;
  const templateIsLoading = isPreviewMode ? previewTemplate.isLoading : false;
  const templateError = isPreviewMode ? previewTemplate.error : null;

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in previewTemplate ? Boolean(previewTemplate.canPreview) : true) 
    : true;

  // Redirect to public URL if preview mode is requested but user can't access preview
  useEffect(() => {
    if (isPreviewMode && !canPreview && !previewTemplate.isLoading) {
      const basePath = getStoreBaseUrl(tenantSlug || '');
      const cleanPath = `${basePath}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath || '/', { replace: true });
    }
  }, [isPreviewMode, canPreview, previewTemplate.isLoading, tenantSlug, searchParams, navigate]);

  // Build context for block rendering
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'home',
    categorySettings,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      social_instagram: storeSettings?.social_instagram || undefined,
      social_facebook: storeSettings?.social_facebook || undefined,
      social_whatsapp: storeSettings?.social_whatsapp || undefined,
      store_description: storeSettings?.store_description || undefined,
      contact_phone: storeSettings?.contact_phone,
      contact_email: storeSettings?.contact_email,
      tenant_id: tenantId,
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
    categories: categories?.map(c => ({ id: c.id, slug: c.slug })),
  };

  return (
    <PublicTemplateRenderer
      content={content}
      context={context}
      isLoading={templateIsLoading || storeLoading}
      error={templateError}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="home"
      bootstrapGlobalLayout={isPreviewMode ? undefined : bootstrapGlobalLayout}
      bootstrapPageOverrides={isPreviewMode ? undefined : bootstrapPageOverrides}
    />
  );
}