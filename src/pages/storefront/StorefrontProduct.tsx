// =============================================
// STOREFRONT PRODUCT - Public product page via Builder
// =============================================

import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePublicProduct, usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext } from '@/lib/builder/types';
import { isPreviewUrl, getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import type { ProductSettings } from '@/hooks/usePageSettings';

export default function StorefrontProduct() {
  const tenantSlug = useTenantSlug();
  const { productSlug } = useParams<{ productSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';
  const { trackViewContent } = useMarketingEvents();

  const { tenant, storeSettings, headerMenu, footerMenu, categories: allCategories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const { product, category, isLoading: productLoading } = usePublicProduct(tenantSlug || '', productSlug || '');
  
  // Track product view when product loads
  useEffect(() => {
    if (product && !productLoading && !isPreviewMode) {
      trackViewContent({
        id: product.id,
        name: product.name,
        price: product.price,
        category: category?.name,
      });
    }
  }, [product?.id, productLoading, isPreviewMode, trackViewContent, category?.name]);
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'product');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'product');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // Check preview access - redirect to public if preview mode but no access
  const canPreview = isPreviewMode 
    ? ('canPreview' in template ? Boolean(template.canPreview) : true) 
    : true;

  // Redirect to public URL if preview mode is requested but user can't access preview
  useEffect(() => {
    if (isPreviewMode && !canPreview && !template.isLoading) {
      const basePath = getStoreBaseUrl(tenantSlug || '');
      const cleanPath = `${basePath}/p/${productSlug}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath, { replace: true });
    }
  }, [isPreviewMode, canPreview, template.isLoading, tenantSlug, productSlug, searchParams, navigate]);

  // Fetch product settings, miniCart config AND categorySettings from PUBLISHED template set content
  // CRITICAL: Must read from published_content, NOT from page_overrides (which reflects draft)
  const { data: templateSettings } = useQuery({
    queryKey: ['product-template-settings-published', tenantSlug, isPreviewMode],
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return null;
      
      // Get store settings to find the published template
      const { data: storeSettings } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      
      const templateSetId = storeSettings?.published_template_id;
      
      if (!templateSetId) {
        // Fallback to page_overrides if no published template (legacy)
        const { data: productData } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenant.id)
          .eq('page_type', 'product')
          .maybeSingle();
        
        const productOverrides = productData?.page_overrides as Record<string, unknown> | null;
        
        // Also fetch categorySettings for product page blocks (e.g., related products)
        const { data: categoryData } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenant.id)
          .eq('page_type', 'category')
          .maybeSingle();
        
        const categoryOverrides = categoryData?.page_overrides as Record<string, unknown> | null;
        
        return {
          productSettings: productOverrides?.productSettings as ProductSettings | null,
          categorySettings: categoryOverrides?.categorySettings || null,
          miniCart: null,
        };
      }
      
      // Read from published_content (or draft_content if preview mode)
      const contentField = isPreviewMode ? 'draft_content' : 'published_content';
      const { data: templateSet } = await supabase
        .from('storefront_template_sets')
        .select(contentField)
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
        .single();
      
      if (!templateSet) return null;
      
      const content = (templateSet as any)[contentField] as Record<string, unknown> | null;
      const themeSettings = content?.themeSettings as Record<string, unknown> | undefined;
      const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
      
      return {
        productSettings: (pageSettings?.product as ProductSettings) || null,
        categorySettings: pageSettings?.category || null,
        miniCart: themeSettings?.miniCart || null,
      };
    },
    enabled: !!tenantSlug,
  });

  const productSettings = templateSettings?.productSettings;
  const miniCartConfig = templateSettings?.miniCart;
  const categorySettings = templateSettings?.categorySettings;

  // If product not found and not loading - show 404, never redirect to home
  if (!product && !productLoading && !template.isLoading) {
    return (
      <Storefront404 
        tenantSlug={tenantSlug || ''} 
        entityType="product" 
        entitySlug={productSlug}
      />
    );
  }

  // Get product images sorted
  const images = product?.product_images || [];
  const sortedImages = [...images].sort((a: any, b: any) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  // Build context for block rendering with product data
  // IMPORTANT: Use tenant.id as primary source (loads first), fallback to storeSettings.tenant_id
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  const context: BlockRenderContext & { categories?: any[]; productSettings?: any; themeSettings?: any; categorySettings?: any } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'product',
    // Pass product settings for ProductDetailsBlock
    productSettings: productSettings || {},
    // Pass categorySettings for product blocks (e.g., related products, carousels)
    categorySettings: categorySettings || {},
    // Pass theme settings including miniCart config for cart action behavior
    themeSettings: {
      miniCart: miniCartConfig || undefined,
    },
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
    categories: allCategories?.map(c => ({ id: c.id, slug: c.slug })),
    product: product ? {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      price: product.price,
      compare_at_price: product.compare_at_price || undefined,
      description: product.description || undefined,
      short_description: product.short_description || undefined,
      stock_quantity: product.stock_quantity,
      allow_backorder: product.allow_backorder || false,
      images: sortedImages.map((img: any) => ({
        url: img.url,
        alt: img.alt_text || product.name,
        is_primary: img.is_primary,
      })),
    } : undefined,
    category: category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
    } : undefined,
  };

  // ProductPageSections is now rendered inside ProductDetailsBlock (single source of truth)

  // ProductPageSections is now rendered inside ProductDetailsBlock (single source of truth)
  // No need for afterContentSlot - the sections render in the correct order within the block

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={context}
      isLoading={template.isLoading || storeLoading || productLoading}
      error={template.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="product"
    />
  );
}
