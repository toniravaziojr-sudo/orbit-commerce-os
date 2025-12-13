// =============================================
// STOREFRONT PRODUCT - Public product page via Builder
// =============================================

import { useParams, useSearchParams } from 'react-router-dom';
import { usePublicProduct, usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer, TemplateEmptyState } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';

export default function StorefrontProduct() {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const { product, category, isLoading: productLoading } = usePublicProduct(tenantSlug || '', productSlug || '');
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'product');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'product');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // If product not found and not loading
  if (!product && !productLoading && !template.isLoading) {
    return <TemplateEmptyState type="product" tenantSlug={tenantSlug || ''} />;
  }

  // Get product images sorted
  const images = product?.product_images || [];
  const sortedImages = [...images].sort((a: any, b: any) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  // Build context for block rendering with product data
  const context: BlockRenderContext = {
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
    },
    headerMenu: headerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
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

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={context}
      isLoading={template.isLoading || storeLoading || productLoading}
      error={template.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
    />
  );
}
