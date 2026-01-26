// =============================================
// STOREFRONT CART - Public cart page
// =============================================
// REGRA CRÍTICA: Esta página NÃO deve renderizar CartContent diretamente.
// O conteúdo do carrinho vem EXCLUSIVAMENTE via template/blocos (CartBlock).
// Isso evita duplicação de UI (template + slot paralelo).

import { useQuery } from '@tanstack/react-query';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { supabase } from '@/integrations/supabase/client';
import { CategorySettings } from '@/hooks/usePageSettings';

export default function StorefrontCart() {
  const tenantSlug = useTenantSlug();

  const { tenant, storeSettings, headerMenu, footerMenu, categories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const template = usePublicTemplate(tenantSlug || '', 'cart');

  // Fetch category settings for product blocks (cross-sell, upsell, etc.)
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

  const { data: categorySettings } = useQuery({
    queryKey: ['category-settings-published', tenantSlug],
    queryFn: async () => {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug || '')
        .single();
      
      if (!tenantData) return defaultCategorySettings;
      
      const { data: storeSettingsData } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenantData.id)
        .maybeSingle();
      
      const templateSetId = storeSettingsData?.published_template_id;
      
      if (!templateSetId) {
        const { data } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenantData.id)
          .eq('page_type', 'category')
          .maybeSingle();
        
        const overrides = data?.page_overrides as Record<string, unknown> | null;
        const saved = (overrides?.categorySettings as CategorySettings) || {};
        return { ...defaultCategorySettings, ...saved };
      }
      
      const { data: templateSet } = await supabase
        .from('storefront_template_sets')
        .select('published_content')
        .eq('id', templateSetId)
        .eq('tenant_id', tenantData.id)
        .single();
      
      if (!templateSet) return defaultCategorySettings;
      
      const content = templateSet.published_content as Record<string, unknown> | null;
      const themeSettings = content?.themeSettings as Record<string, unknown> | undefined;
      const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
      const saved = (pageSettings?.category as CategorySettings) || {};
      
      return { ...defaultCategorySettings, ...saved };
    },
    enabled: !!tenantSlug,
  });

  // Build context for block rendering - NO afterHeaderSlot (template-only rendering)
  // IMPORTANT: Use tenant.id as primary source (loads first), fallback to storeSettings.tenant_id
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    pageType: 'cart',
    // Pass categorySettings for product blocks (cross-sell, upsell)
    categorySettings: categorySettings || defaultCategorySettings,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      // NOTE: primary_color removed - colors managed via Configuração do tema > Cores
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
