// =============================================
// STOREFRONT CATEGORY - Public category page via Builder
// =============================================
// OPTIMIZED v2: Uses bootstrap data for template + categorySettings (no extra queries)

import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePublicCategory, usePublicStorefront } from '@/hooks/useStorefront';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { CategorySettings } from '@/hooks/usePageSettings';
import { getDefaultTemplate } from '@/lib/builder/defaults';

const defaultCategorySettings: CategorySettings = {
  showCategoryName: true,
  showBanner: true,
  showRatings: true,
  showAddToCartButton: true,
  quickBuyEnabled: false,
  showBadges: true,
  buyNowButtonText: 'Comprar agora',
  defaultSortOrder: 'relevance',
  customButtonEnabled: false,
  customButtonText: '',
  customButtonColor: '',
  customButtonLink: '',
};

export default function StorefrontCategory() {
  const tenantSlug = useTenantSlug();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';
  const { trackViewCategory } = useMarketingEvents();

  const { 
    storeSettings, headerMenu, footerMenu, categories: allCategories, isLoading: storeLoading,
    globalLayout: bootstrapGlobalLayout,
    pageOverrides: bootstrapPageOverrides,
    categorySettings: bootstrapCategorySettings,
    template: bootstrapTemplate,
  } = usePublicStorefront(tenantSlug || '');
  const { category, products, isLoading: categoryLoading } = usePublicCategory(tenantSlug || '', categorySlug || '');
  
  // Track category view when category loads
  useEffect(() => {
    if (category && !categoryLoading && !isPreviewMode) {
      trackViewCategory({
        id: category.id,
        name: category.name,
        slug: category.slug,
        productIds: products?.map(p => p.id),
      });
    }
  }, [category?.id, categoryLoading, isPreviewMode, trackViewCategory, products]);
  
  // Derive template content from bootstrap (no extra queries in normal mode!)
  const templateContent = useMemo<BlockNode>(() => {
    if (!bootstrapTemplate?.published_content) return getDefaultTemplate('category');
    const content = bootstrapTemplate.published_content as Record<string, BlockNode | null>;
    return content?.category || getDefaultTemplate('category');
  }, [bootstrapTemplate]);

  const categorySettings = useMemo(() => {
    return { ...defaultCategorySettings, ...(bootstrapCategorySettings || {}) };
  }, [bootstrapCategorySettings]);

  // Use preview hook ONLY in preview mode
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'category');
  
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
      const cleanPath = `${basePath}/c/${categorySlug}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath, { replace: true });
    }
  }, [isPreviewMode, canPreview, previewTemplate.isLoading, tenantSlug, categorySlug, searchParams, navigate]);

  // If category not found and not loading - show 404, never redirect to home
  const isAnyLoading = categoryLoading || templateIsLoading || storeLoading;
  if (!category && !isAnyLoading) {
    return (
      <Storefront404 
        tenantSlug={tenantSlug || ''} 
        entityType="category" 
        entitySlug={categorySlug}
      />
    );
  }

  // Build context for block rendering with category data
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'category',
    showRatings: categorySettings?.showRatings !== false,
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
    category: category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || undefined,
      image_url: category.image_url || undefined,
      banner_desktop_url: category.banner_desktop_url || undefined,
      banner_mobile_url: category.banner_mobile_url || undefined,
    } : undefined,
    products: products?.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compare_at_price: p.compare_at_price || undefined,
      image_url: p.product_images?.[0]?.url || undefined,
    })),
  };

  return (
    <PublicTemplateRenderer
      content={content}
      context={context}
      isLoading={templateIsLoading || storeLoading || categoryLoading}
      error={templateError}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="category"
      bootstrapGlobalLayout={isPreviewMode ? undefined : bootstrapGlobalLayout}
      bootstrapPageOverrides={isPreviewMode ? undefined : bootstrapPageOverrides}
    />
  );
}
