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

interface CategorySettings {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
}

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
  
  // Fetch category settings from page_overrides
  const { data: categorySettings } = useQuery({
    queryKey: ['category-settings', tenantSlug],
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug || '')
        .single();
      
      if (!tenant) return { showCategoryName: true, showBanner: true, showRatings: true };
      
      const { data } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenant.id)
        .eq('page_type', 'category')
        .maybeSingle();
      
      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.categorySettings as CategorySettings) || { showCategoryName: true, showBanner: true, showRatings: true };
    },
    enabled: !!tenantSlug,
  });
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'category');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'category');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // If category not found and not loading - show 404, never redirect to home
  if (!category && !categoryLoading && !template.isLoading) {
    return (
      <Storefront404 
        tenantSlug={tenantSlug || ''} 
        entityType="category" 
        entitySlug={categorySlug}
      />
    );
  }

  // Build category header slot (banner + name) based on settings
  const showBanner = categorySettings?.showBanner !== false;
  const showName = categorySettings?.showCategoryName !== false;
  const bannerDesktop = category?.banner_desktop_url;
  const bannerMobile = category?.banner_mobile_url;
  const hasBanner = showBanner && (bannerDesktop || bannerMobile);

  const categoryHeaderSlot = (hasBanner || (showName && category?.name)) ? (
    <div className="w-full">
      {hasBanner && (
        <picture>
          {bannerMobile && (
            <source media="(max-width: 767px)" srcSet={bannerMobile} />
          )}
          {bannerDesktop && (
            <source media="(min-width: 768px)" srcSet={bannerDesktop} />
          )}
          <img
            src={bannerDesktop || bannerMobile}
            alt={`Banner ${category?.name || 'Categoria'}`}
            className="w-full h-auto object-cover"
          />
        </picture>
      )}
      {showName && category?.name && (
        <h1 className="text-2xl md:text-3xl font-bold text-foreground px-4 py-6 text-center bg-background">
          {category.name}
        </h1>
      )}
    </div>
  ) : undefined;

  // Build context for block rendering with category data
  const context: BlockRenderContext & { categories?: any[] } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'category',
    // Pass category header (banner + name) via afterHeaderSlot
    afterHeaderSlot: categoryHeaderSlot,
    // Pass showRatings setting for product cards
    showRatings: categorySettings?.showRatings !== false,
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
