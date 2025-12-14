// =============================================
// PAGE BUILDER - Edit institutional pages with visual builder
// =============================================

import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { usePageBuilder } from '@/hooks/usePageBuilder';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function PageBuilder() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();
  const { page, draftVersion, isLoading } = usePageBuilder(pageId);

  // Fetch header menu for editor context (same as StorefrontBuilder)
  const { data: headerMenuData } = useQuery({
    queryKey: ['editor-header-menu', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      
      // First find the header menu
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('location', 'header')
        .maybeSingle();
      
      if (menuError || !menu) return null;
      
      // Then fetch menu items with full info for proper URL generation
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('id, label, url, item_type, ref_id, sort_order')
        .eq('menu_id', menu.id)
        .order('sort_order');
      
      if (itemsError) return null;
      
      return items || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch categories for resolving category menu item URLs
  const { data: categoriesData } = useQuery({
    queryKey: ['editor-categories', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from('categories')
        .select('id, slug')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch pages for resolving page menu item URLs
  const { data: pagesData } = useQuery({
    queryKey: ['editor-pages', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from('store_pages')
        .select('id, slug, type')
        .eq('tenant_id', currentTenant.id);
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Helper to build menu item URL
  const buildMenuItemUrl = (item: any): string => {
    const baseUrl = currentTenant ? `/store/${currentTenant.slug}` : '';
    
    if (item.item_type === 'external' && item.url) {
      return item.url;
    }
    if (item.item_type === 'category' && item.ref_id) {
      const category = categoriesData?.find(c => c.id === item.ref_id);
      return category ? `${baseUrl}/c/${category.slug}` : baseUrl;
    }
    if (item.item_type === 'page' && item.ref_id) {
      const page = pagesData?.find(p => p.id === item.ref_id);
      if (page) {
        return `${baseUrl}/page/${page.slug}`;
      }
    }
    return item.url || baseUrl;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando editor...</p>
        </div>
      </div>
    );
  }

  if (!page || !currentTenant) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Página não encontrada</p>
          <Button onClick={() => navigate('/pages')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const context: BlockRenderContext = {
    tenantSlug: currentTenant.slug,
    isPreview: false,
    settings: {
      store_name: storeSettings?.store_name || currentTenant.name,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
    },
    // Include header menu in editor context (with resolved URLs)
    headerMenu: headerMenuData?.map(item => ({
      id: item.id,
      label: item.label,
      url: buildMenuItemUrl(item),
    })) || [],
  };

  // Determine page type from page data
  const pageType = page.type === 'landing_page' ? 'landing_page' : 'institutional';

  return (
    <VisualBuilder
      tenantId={currentTenant.id}
      pageType={pageType}
      pageId={pageId}
      pageTitle={page.title}
      initialContent={draftVersion?.content}
      context={context}
    />
  );
}
