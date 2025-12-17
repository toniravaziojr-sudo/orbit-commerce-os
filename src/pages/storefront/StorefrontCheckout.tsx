// =============================================
// STOREFRONT CHECKOUT - Public checkout page
// =============================================
// REGRA CRÍTICA: Esta página NÃO deve renderizar CheckoutContent diretamente.
// O conteúdo do checkout vem EXCLUSIVAMENTE via template/blocos (CheckoutBlock).
// Isso evita duplicação de UI (template + slot paralelo).

import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';

export default function StorefrontCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { tenant, storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const template = usePublicTemplate(tenantSlug || '', 'checkout');

  // Build context for block rendering - NO afterHeaderSlot (template-only rendering)
  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    // REMOVED: afterHeaderSlot - checkout content comes from template blocks only
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
    })),
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
  };

  return (
    <PublicTemplateRenderer
      content={template.content}
      context={context}
      isLoading={template.isLoading || storeLoading}
      error={template.error}
      isPreviewMode={false}
      canPreview={true}
      isCheckout={true}
      pageType="checkout"
    />
  );
}
