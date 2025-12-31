// =============================================
// TEMPLATE BUILDER - Edit page templates with visual builder
// =============================================

import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { buildMenuItemUrl as buildMenuUrl } from '@/lib/publicUrls';

export default function TemplateBuilder() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();
  const queryClient = useQueryClient();

  // Fetch template data
  const { data: template, isLoading } = useQuery({
    queryKey: ['page-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from('page_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!templateId && !!currentTenant?.id,
  });

  // Fetch header menu for editor context
  const { data: headerMenuData } = useQuery({
    queryKey: ['editor-header-menu', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data: menu } = await supabase
        .from('menus')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('location', 'header')
        .maybeSingle();
      if (!menu) return null;
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, label, url, item_type, ref_id, sort_order, parent_id')
        .eq('menu_id', menu.id)
        .order('sort_order');
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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (content: BlockNode) => {
      if (!templateId) throw new Error('Template ID required');
      const { error } = await supabase
        .from('page_templates')
        .update({ content: content as any, updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-template', templateId] });
      queryClient.invalidateQueries({ queryKey: ['page-templates'] });
      toast.success('Template salvo com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
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

  if (!template || !currentTenant) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Modelo não encontrado</p>
          <Button onClick={() => navigate('/page-templates')}>
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
    // For template editing, we show placeholder text for page content
    pageContent: '<p style="color:#888;text-align:center;padding:40px;">[Conteúdo individual da página será exibido aqui]</p>',
  };

  return (
    <VisualBuilder
      tenantId={currentTenant.id}
      pageType="page_template"
      pageId={templateId}
      pageTitle={template.name}
      pageSlug={template.slug}
      initialContent={template.content as unknown as BlockNode}
      context={context}
    />
  );
}
