// =============================================
// STOREFRONT HOME - Public home page via Builder
// =============================================

import { useParams, useSearchParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';

export default function StorefrontHome() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, categories, isPublished, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'home');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'home');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // Build context for block rendering - include all needed data for header/footer
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
      // Extended settings for header/footer
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
    categories: categories?.map(c => ({ id: c.id, slug: c.slug })),
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
      pageType="home"
    />
  );
}
