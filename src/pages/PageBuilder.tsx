// =============================================
// PAGE BUILDER - Edit institutional pages via their template
// =============================================

import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildMenuItemUrl as buildMenuUrl } from '@/lib/publicUrls';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

export default function PageBuilder() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();

  // Get page info with template_id
  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ['store-page', pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const { data, error } = await supabase
        .from('store_pages')
        .select('*, page_templates(*)')
        .eq('id', pageId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!pageId,
  });

  // Fetch header menu for editor context
  const { data: headerMenuData } = useQuery({
    queryKey: ['editor-header-menu', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('location', 'header')
        .maybeSingle();
      
      if (menuError || !menu) return null;
      
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('id, label, url, item_type, ref_id, sort_order, parent_id')
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

  // Helper to build menu item URL using centralized utility
  const buildMenuItemUrl = (item: any): string => {
    if (!currentTenant) return '';
    return buildMenuUrl(currentTenant.slug, item, categoriesData || [], pagesData || []);
  };

  if (pageLoading) {
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
    headerMenu: headerMenuData?.map(item => ({
      id: item.id,
      label: item.label,
      url: buildMenuItemUrl(item),
      item_type: item.item_type,
      ref_id: item.ref_id,
      sort_order: item.sort_order,
      parent_id: item.parent_id,
    })) || [],
    // Pass individual_content to context for PageContent block rendering
    pageContent: (page.individual_content as string) || undefined,
    page: {
      title: page.title,
      slug: page.slug,
    },
  };

  // Priority: Use page's own content (imported pages) > template content > undefined
  // Imported pages have their content in the 'content' field as block structure
  const pageOwnContent = page.content as unknown as BlockNode | null;
  const templateId = page.template_id;
  const template = page.page_templates as { id: string; content: Json; name: string } | null;
  
  // Get initial content - prioritize page's own content for imported pages
  const initialContent = pageOwnContent 
    ? pageOwnContent 
    : template?.content 
      ? (template.content as unknown as BlockNode)
      : undefined;

  // Determine pageType based on the actual page type
  // For page overrides to work correctly, we need to pass the correct pageType
  const effectivePageType = (page.type === 'landing_page' ? 'landing_page' : 'institutional') as 
    'institutional' | 'landing_page';

  return (
    <VisualBuilder
      tenantId={currentTenant.id}
      pageType={effectivePageType}
      pageId={pageId}
      pageTitle={page.title}
      pageSlug={page.slug}
      initialContent={initialContent}
      context={context}
    />
  );
}
