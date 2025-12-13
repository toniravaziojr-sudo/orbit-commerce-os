// =============================================
// STOREFRONT CHECKOUT - Public checkout page via Builder
// =============================================

import { useParams, useSearchParams } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';

export default function StorefrontCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const { items, subtotal, clearCart } = useCart(tenantSlug || '');
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'checkout');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'checkout');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // Build context for block rendering with checkout data
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
    // Checkout-specific context
    checkout: {
      items: items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        image_url: item.image_url,
      })),
      subtotal,
      clearCart,
    },
  };

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in template ? Boolean(template.canPreview) : true) 
    : true;

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={context}
      isLoading={template.isLoading || storeLoading}
      error={template.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
    />
  );
}
