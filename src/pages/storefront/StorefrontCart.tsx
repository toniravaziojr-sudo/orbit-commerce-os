// =============================================
// STOREFRONT CART - Public cart page
// =============================================
// REGRA CRÍTICA: Esta página NÃO deve renderizar CartContent diretamente.
// O conteúdo do carrinho vem EXCLUSIVAMENTE via template/blocos (CartBlock).
// Isso evita duplicação de UI (template + slot paralelo).
// OPTIMIZED v2: Uses bootstrap data for template + categorySettings (no extra queries)

import { useMemo } from 'react';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';

import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { useTenantSlug } from '@/hooks/useTenantSlug';
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

export default function StorefrontCart() {
  const tenantSlug = useTenantSlug();

  const { 
    tenant, storeSettings, headerMenu, footerMenu, categories, isLoading: storeLoading,
    globalLayout: bootstrapGlobalLayout,
    pageOverrides: bootstrapPageOverrides,
    categorySettings: bootstrapCategorySettings,
    template: bootstrapTemplate,
  } = usePublicStorefront(tenantSlug || '');

  // Derive template content from bootstrap (no extra queries!)
  const templateContent = useMemo<BlockNode>(() => {
    if (!bootstrapTemplate?.published_content) return getDefaultTemplate('cart');
    const content = bootstrapTemplate.published_content as Record<string, BlockNode | null>;
    return content?.cart || getDefaultTemplate('cart');
  }, [bootstrapTemplate]);

  const categorySettings = useMemo(() => {
    return { ...defaultCategorySettings, ...(bootstrapCategorySettings || {}) };
  }, [bootstrapCategorySettings]);

  // Build context for block rendering
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    pageType: 'cart',
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
    <>
      
      
      <PublicTemplateRenderer
        content={templateContent}
        context={context}
        isLoading={storeLoading}
        isPreviewMode={false}
        canPreview={true}
        pageType="cart"
        bootstrapGlobalLayout={bootstrapGlobalLayout}
        bootstrapPageOverrides={bootstrapPageOverrides}
      />
    </>
  );
}
