// =============================================
// STOREFRONT CATEGORY - Public category page via Builder
// =============================================

import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePublicCategory, usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext } from '@/lib/builder/types';
import { supabase } from '@/integrations/supabase/client';
import { getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { CategorySettings } from '@/hooks/usePageSettings';

export default function StorefrontCategory() {
  const tenantSlug = useTenantSlug();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';
  const { trackViewCategory } = useMarketingEvents();

  const { storeSettings, headerMenu, footerMenu, categories: allCategories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
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
  
  // Fetch category settings from PUBLISHED template set content
  // CRITICAL: Must read from published_content, NOT from page_overrides (which reflects draft)
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
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug || '')
        .single();
      
      if (!tenant) return defaultCategorySettings;
      
      // Get store settings to find the published template
      const { data: storeSettings } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      
      const templateSetId = storeSettings?.published_template_id;
      
      if (!templateSetId) {
        // Fallback to page_overrides if no published template (legacy)
        const { data } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenant.id)
          .eq('page_type', 'category')
          .maybeSingle();
        
        const overrides = data?.page_overrides as Record<string, unknown> | null;
        const saved = (overrides?.categorySettings as CategorySettings) || {};
        return { ...defaultCategorySettings, ...saved };
      }
      
      // Read from published_content (or draft_content if preview mode)
      const contentField = isPreviewMode ? 'draft_content' : 'published_content';
      const { data: templateSet } = await supabase
        .from('storefront_template_sets')
        .select(contentField)
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
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
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'category');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'category');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // Show loading state while any data is still loading
  const isAnyLoading = categoryLoading || template.isLoading || storeLoading;
  
  // If category not found and not loading - show 404, never redirect to home
  if (!category && !isAnyLoading) {
    return (
      <Storefront404 
        tenantSlug={tenantSlug || ''} 
        entityType="category" 
        entitySlug={categorySlug}
      />
    );
  }

  // Category data is now rendered via CategoryBannerBlock in the template
  // No need for categoryHeaderSlot - removed to avoid duplication

  // Build context for block rendering with category data
  // CRITICAL: Pass all categorySettings to context for blocks to consume
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'category',
    // Pass showRatings setting for product cards (legacy)
    showRatings: categorySettings?.showRatings !== false,
    // Pass full categorySettings for CategoryPageLayout to consume
    categorySettings: categorySettings || {
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
    },
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
    // Category-specific context
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

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in template ? Boolean(template.canPreview) : true) 
    : true;

  // Redirect to public URL if preview mode is requested but user can't access preview
  useEffect(() => {
    if (isPreviewMode && !canPreview && !template.isLoading) {
      const basePath = getStoreBaseUrl(tenantSlug || '');
      const cleanPath = `${basePath}/c/${categorySlug}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath, { replace: true });
    }
  }, [isPreviewMode, canPreview, template.isLoading, tenantSlug, categorySlug, searchParams, navigate]);

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={context}
      isLoading={template.isLoading || storeLoading || categoryLoading}
      error={template.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="category"
    />
  );
}
