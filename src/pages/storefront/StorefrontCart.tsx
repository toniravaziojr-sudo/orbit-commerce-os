// =============================================
// STOREFRONT CART - Public cart page
// =============================================
// REGRA CRÍTICA: Esta página NÃO deve renderizar CartContent diretamente.
// O conteúdo do carrinho vem EXCLUSIVAMENTE via template/blocos (CartBlock).
// Isso evita duplicação de UI (template + slot paralelo).

import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';
import { useTenantSlug } from '@/hooks/useTenantSlug';

export default function StorefrontCart() {
  const tenantSlug = useTenantSlug();

  const { tenant, storeSettings, headerMenu, footerMenu, categories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const template = usePublicTemplate(tenantSlug || '', 'cart');

  // Build context for block rendering - NO afterHeaderSlot (template-only rendering)
  // IMPORTANT: Use tenant.id as primary source (loads first), fallback to storeSettings.tenant_id
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  const context: BlockRenderContext & { categories?: any[] } = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    // REMOVED: afterHeaderSlot - cart content comes from template blocks only
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
    categories: categories?.map(c => ({ id: c.id, slug: c.slug })),
  };

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={context}
      isLoading={template.isLoading || storeLoading}
      error={template.error}
      isPreviewMode={false}
      canPreview={true}
      pageType="cart"
    />
  );
}
