// =============================================
// STOREFRONT PRODUCT - Public product page via Builder
// =============================================
// OPTIMIZED v2: Uses bootstrap data for template + settings (no extra queries)

import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePublicProduct, usePublicStorefront } from '@/hooks/useStorefront';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import type { ProductSettings } from '@/hooks/usePageSettings';

export default function StorefrontProduct() {
  const tenantSlug = useTenantSlug();
  const { productSlug } = useParams<{ productSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';
  const { trackViewContent } = useMarketingEvents();

  const { 
    tenant, storeSettings, headerMenu, footerMenu, categories: allCategories, isLoading: storeLoading,
    globalLayout: bootstrapGlobalLayout,
    pageOverrides: bootstrapPageOverrides,
    categorySettings: bootstrapCategorySettings,
    template: bootstrapTemplate,
  } = usePublicStorefront(tenantSlug || '');
  const { product, category, isLoading: productLoading } = usePublicProduct(tenantSlug || '', productSlug || '');
  
  // Track product view when product loads
  useEffect(() => {
    if (product && !productLoading && !isPreviewMode) {
      trackViewContent({
        id: product.id,
        sku: product.sku,
        meta_retailer_id: product.meta_retailer_id,
        name: product.name,
        price: product.price,
        category: category?.name,
      });
    }
  }, [product?.id, productLoading, isPreviewMode, trackViewContent, category?.name]);
  
  // Derive template content from bootstrap (no extra queries in normal mode!)
  const templateContent = useMemo<BlockNode>(() => {
    if (!bootstrapTemplate?.published_content) return getDefaultTemplate('product');
    const content = bootstrapTemplate.published_content as Record<string, BlockNode | null>;
    return content?.product || getDefaultTemplate('product');
  }, [bootstrapTemplate]);

  // Extract product settings and miniCart config from bootstrap template
  const templateSettings = useMemo(() => {
    if (!bootstrapTemplate?.published_content) return null;
    const content = bootstrapTemplate.published_content as Record<string, any>;
    const themeSettings = content?.themeSettings as Record<string, any> | undefined;
    const pageSettings = themeSettings?.pageSettings as Record<string, any> | undefined;
    return {
      productSettings: (pageSettings?.product as ProductSettings) || null,
      categorySettings: pageSettings?.category || null,
      miniCart: themeSettings?.miniCart || null,
    };
  }, [bootstrapTemplate]);

  // Use preview hook ONLY in preview mode
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'product');
  
  const contentNode = isPreviewMode ? previewTemplate.content : templateContent;
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
      const cleanPath = `${basePath}/p/${productSlug}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath, { replace: true });
    }
  }, [isPreviewMode, canPreview, previewTemplate.isLoading, tenantSlug, productSlug, searchParams, navigate]);

  const productSettings = templateSettings?.productSettings;
  const miniCartConfig = templateSettings?.miniCart;
  const categorySettings = templateSettings?.categorySettings || bootstrapCategorySettings;

  // If product not found and not loading - show 404
  if (!product && !productLoading && !templateIsLoading) {
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
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  const context: BlockRenderContext & { categories?: any[]; productSettings?: any; themeSettings?: any; categorySettings?: any } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'product',
    productSettings: productSettings || {},
    categorySettings: categorySettings || {},
    themeSettings: {
      miniCart: miniCartConfig || undefined,
    },
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

  return (
    <PublicTemplateRenderer
      content={contentNode}
      context={context}
      isLoading={templateIsLoading || storeLoading || productLoading}
      error={templateError}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="product"
      bootstrapGlobalLayout={isPreviewMode ? undefined : bootstrapGlobalLayout}
      bootstrapPageOverrides={isPreviewMode ? undefined : bootstrapPageOverrides}
    />
  );
}
