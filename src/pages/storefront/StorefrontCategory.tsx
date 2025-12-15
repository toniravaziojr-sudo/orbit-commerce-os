// =============================================
// STOREFRONT CATEGORY - Public category page via Builder
// =============================================

import { useParams, useSearchParams } from 'react-router-dom';
import { usePublicCategory, usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { BlockRenderContext } from '@/lib/builder/types';

export default function StorefrontCategory() {
  const { tenantSlug, categorySlug } = useParams<{ tenantSlug: string; categorySlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, categories: allCategories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const { category, products, isLoading: categoryLoading } = usePublicCategory(tenantSlug || '', categorySlug || '');
  
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

  // Build context for block rendering with category data
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
    // Category-specific context
    category: category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || undefined,
      image_url: category.image_url || undefined,
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
