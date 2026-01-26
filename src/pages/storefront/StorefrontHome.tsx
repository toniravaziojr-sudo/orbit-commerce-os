// =============================================
// STOREFRONT HOME - Public home page via Builder
// =============================================

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';
import { getCleanQueryString } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { supabase } from '@/integrations/supabase/client';
import { CategorySettings } from '@/hooks/usePageSettings';

export default function StorefrontHome() {
  const tenantSlug = useTenantSlug();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { tenant, storeSettings, headerMenu, footerMenu, categories, isPublished, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  
  // Fetch category settings from PUBLISHED template set content
  // CRITICAL: Blocos de produtos na Home também devem respeitar categorySettings
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
    queryKey: ['category-settings-published', tenantSlug, isPreviewMode],
    queryFn: async () => {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug || '')
        .single();
      
      if (!tenantData) return defaultCategorySettings;
      
      // Get store settings to find the published template
      const { data: storeSettingsData } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenantData.id)
        .maybeSingle();
      
      const templateSetId = storeSettingsData?.published_template_id;
      
      if (!templateSetId) {
        // Fallback to page_overrides if no published template (legacy)
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
      
      // Read from published_content (or draft_content if preview mode)
      const contentField = isPreviewMode ? 'draft_content' : 'published_content';
      const { data: templateSet } = await supabase
        .from('storefront_template_sets')
        .select(contentField)
        .eq('id', templateSetId)
        .eq('tenant_id', tenantData.id)
        .single();
      
      if (!templateSet) return defaultCategorySettings;
      
      const content = (templateSet as any)[contentField] as Record<string, unknown> | null;
      const themeSettings = content?.themeSettings as Record<string, unknown> | undefined;
      const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
      const saved = (pageSettings?.category as CategorySettings) || {};
      
      return { ...defaultCategorySettings, ...saved };
    },
    enabled: !!tenantSlug,
  });
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicTemplate = usePublicTemplate(tenantSlug || '', 'home');
  const previewTemplate = usePreviewTemplate(tenantSlug || '', 'home');
  
  const template = isPreviewMode ? previewTemplate : publicTemplate;

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in template ? Boolean(template.canPreview) : true) 
    : true;

  // Redirect to public URL if preview mode is requested but user can't access preview
  useEffect(() => {
    if (isPreviewMode && !canPreview && !template.isLoading) {
      const basePath = getStoreBaseUrl(tenantSlug || '');
      const cleanPath = `${basePath}${getCleanQueryString(searchParams)}`;
      navigate(cleanPath || '/', { replace: true });
    }
  }, [isPreviewMode, canPreview, template.isLoading, tenantSlug, searchParams, navigate]);

  // Build context for block rendering - include all needed data for header/footer
  // IMPORTANT: Use tenant.id as primary source (loads first), fallback to storeSettings.tenant_id
  const tenantId = tenant?.id || storeSettings?.tenant_id;
  
  // CRITICAL: Pass categorySettings to context for product blocks to consume
  const context: BlockRenderContext & { categories?: any[]; categorySettings?: CategorySettings } = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    pageType: 'home',
    // Pass full categorySettings for product blocks to consume
    categorySettings: categorySettings || defaultCategorySettings,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      // NOTE: primary_color removed - colors managed via Configuração do tema > Cores
      social_instagram: storeSettings?.social_instagram || undefined,
      social_facebook: storeSettings?.social_facebook || undefined,
      social_whatsapp: storeSettings?.social_whatsapp || undefined,
      store_description: storeSettings?.store_description || undefined,
      // Extended settings for header/footer
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
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
      pageType="home"
    />
  );
}
