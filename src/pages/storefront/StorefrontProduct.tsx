// =============================================
// STOREFRONT PRODUCT - Public product page via Builder
// =============================================

import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePublicProduct, usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { ProductPageSections } from '@/components/storefront/ProductPageSections';
import { BlockRenderContext } from '@/lib/builder/types';

export default function StorefrontProduct() {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, categories: allCategories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const { product, category, isLoading: productLoading } = usePublicProduct(tenantSlug || '', productSlug || '');
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'product');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'product');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // Fetch product settings (page_overrides)
  const { data: productSettings } = useQuery({
    queryKey: ['product-template-settings', tenantSlug],
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return null;
      
      const { data } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenant.id)
        .eq('page_type', 'product')
        .maybeSingle();
      
      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return overrides?.productSettings as {
        showRelatedProducts?: boolean;
        showBuyTogether?: boolean;
        showReviews?: boolean;
        showDescription?: boolean;
      } | null;
    },
    enabled: !!tenantSlug,
  });

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
    // Product-specific context
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

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in template ? Boolean(template.canPreview) : true) 
    : true;

  // Build product sections slot based on settings
  const showBuyTogether = productSettings?.showBuyTogether !== false;
  const showRelatedProducts = productSettings?.showRelatedProducts !== false;
  const showReviews = productSettings?.showReviews !== false;
  const showDescription = productSettings?.showDescription !== false;
  
  
  const productSectionsSlot = product ? (
    <ProductPageSections
      product={{
        id: product.id,
        name: product.name,
        price: product.price,
        compare_at_price: product.compare_at_price || undefined,
        sku: product.sku,
        description: product.description || undefined,
        images: sortedImages.map((img: any) => ({
          url: img.url,
          alt: img.alt_text || product.name,
        })),
      }}
      tenantSlug={tenantSlug || ''}
      showDescription={showDescription}
      showBuyTogether={showBuyTogether}
      showReviews={showReviews}
      showRelatedProducts={showRelatedProducts}
    />
  ) : null;

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={{...context, afterContentSlot: productSectionsSlot}}
      isLoading={template.isLoading || storeLoading || productLoading}
      error={template.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="product"
    />
  );
}
