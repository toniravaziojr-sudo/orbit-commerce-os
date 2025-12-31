// =============================================
// BLOG POST EDITOR - Visual editor for blog posts
// Uses the same VisualBuilder as PageBuilder
// =============================================

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { buildMenuItemUrl as buildMenuUrl } from '@/lib/publicUrls';

export default function BlogPostEditor() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();

  // Fetch blog post
  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post-editor', postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!postId,
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

  // Helper to build menu item URL
  const buildMenuItemUrl = (item: any): string => {
    if (!currentTenant) return '';
    return buildMenuUrl(currentTenant.slug, item, categoriesData || [], pagesData || []);
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

  if (!post || !currentTenant) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Post não encontrado</p>
          <Button onClick={() => navigate('/blog')}>
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
  };

  return (
    <VisualBuilder
      tenantId={currentTenant.id}
      pageType="institutional"
      pageId={postId}
      pageTitle={post.title}
      pageSlug={post.slug}
      initialContent={post.content as unknown as BlockNode}
      context={context}
    />
  );
}
