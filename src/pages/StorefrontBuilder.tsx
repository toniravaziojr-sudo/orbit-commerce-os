// =============================================
// STOREFRONT BUILDER PAGE - Admin page for builder
// =============================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useStorefrontTemplates, useTemplateVersion } from '@/hooks/useBuilderData';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Eye, CheckCircle2, Clock, ExternalLink, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildMenuItemUrl, getPreviewUrlForEditor, getPublicHomeUrl } from '@/lib/publicUrls';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'tracking' | 'blog';

const pageTypeInfo: Record<PageType, { title: string; description: string; icon: string; isSystem?: boolean }> = {
  home: { title: 'Página Inicial', description: 'Página principal da loja', icon: '🏠' },
  category: { title: 'Categoria', description: 'Listagem de produtos', icon: '📁' },
  product: { title: 'Produto', description: 'Detalhes do produto', icon: '📦' },
  cart: { title: 'Carrinho', description: 'Carrinho de compras', icon: '🛒' },
  checkout: { title: 'Checkout', description: 'Página de sistema - configure em Integrações', icon: '💳', isSystem: true },
  thank_you: { title: 'Obrigado', description: 'Confirmação do pedido', icon: '✅' },
  account: { title: 'Minha Conta', description: 'Hub do cliente', icon: '👤' },
  account_orders: { title: 'Pedidos', description: 'Lista de pedidos', icon: '📋' },
  account_order_detail: { title: 'Pedido', description: 'Detalhe do pedido', icon: '📄' },
  tracking: { title: 'Rastreio', description: 'Página de rastreio de pedidos', icon: '📍', isSystem: true },
  blog: { title: 'Blog', description: 'Índice do blog', icon: '📰', isSystem: true },
};

export default function StorefrontBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  
  const editingPageType = searchParams.get('edit') as PageType | null;
  
  // Check if editing a system page (tracking or blog)
  const isSystemPage = editingPageType === 'tracking' || editingPageType === 'blog';
  const systemPageSlug = editingPageType === 'tracking' ? 'rastreio' : editingPageType === 'blog' ? 'blog' : null;
  
  const { data: templates, isLoading: templatesLoading } = useStorefrontTemplates();
  
  // Fetch system page data when editing tracking or blog
  const { data: systemPageData, isLoading: systemPageLoading } = useQuery({
    queryKey: ['system-page', currentTenant?.id, systemPageSlug],
    queryFn: async () => {
      if (!currentTenant?.id || !systemPageSlug) return null;
      
      // Get the page
      const { data: page, error: pageError } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('slug', systemPageSlug)
        .eq('is_system', true)
        .maybeSingle();
      
      if (pageError) throw pageError;
      if (!page) return null;
      
      // If there's a draft version, get the version content
      if (page.draft_version) {
        const { data: version, error: versionError } = await supabase
          .from('store_page_versions')
          .select('content')
          .eq('page_id', page.id)
          .eq('version', page.draft_version)
          .maybeSingle();
        
        if (!versionError && version) {
          return { ...page, content: version.content };
        }
      }
      
      return page;
    },
    enabled: !!currentTenant?.id && isSystemPage && !!systemPageSlug,
  });
  
  // Use template version only for non-system pages
  const { data: templateData, isLoading: templateLoading } = useTemplateVersion(
    !isSystemPage ? (editingPageType || 'home') : 'home', 
    'draft'
  );

  // Fetch header menu for editor context
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
        .select('id, label, url, item_type, ref_id, sort_order, parent_id')
        .eq('menu_id', menu.id)
        .order('sort_order');
      
      if (itemsError) return null;
      
      return items || [];
    },
    enabled: !!currentTenant?.id && !!editingPageType,
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
    enabled: !!currentTenant?.id && !!editingPageType,
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
    enabled: !!currentTenant?.id && !!editingPageType,
  });

  // Helper to build menu item URL using centralized utility
  const getMenuItemUrl = (item: any): string => {
    if (!currentTenant) return '';
    return buildMenuItemUrl(currentTenant.slug, item, categoriesData || [], pagesData || []);
  };

  // If editing a specific page type, show the builder
  if (editingPageType && currentTenant) {
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
        url: getMenuItemUrl(item),
        item_type: item.item_type,
        ref_id: item.ref_id,
        sort_order: item.sort_order,
        parent_id: item.parent_id,
      })) || [],
    };

    // Loading state - check both template and system page loading
    const isEditorLoading = isSystemPage ? systemPageLoading : templateLoading;
    
    if (isEditorLoading) {
      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando editor...</p>
          </div>
        </div>
      );
    }

    // For system pages, use the system page data
    if (isSystemPage && systemPageData) {
      return (
        <VisualBuilder
          tenantId={currentTenant.id}
          pageType={editingPageType}
          pageId={systemPageData.id}
          pageTitle={pageTypeInfo[editingPageType]?.title}
          pageSlug={systemPageSlug || undefined}
          initialContent={systemPageData.content as unknown as BlockNode | undefined}
          context={context}
        />
      );
    }

    // For regular templates
    return (
      <VisualBuilder
        tenantId={currentTenant.id}
        pageType={editingPageType}
        initialContent={templateData?.content}
        context={context}
      />
    );
  }

  const getPreviewUrl = (pageType: PageType) => {
    if (!currentTenant) return '#';
    return getPreviewUrlForEditor(currentTenant.slug, pageType);
  };

  // Otherwise, show the template list (management view)
  return (
    <TooltipProvider>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gerenciador de Páginas</h1>
            <p className="text-muted-foreground">
              Gerencie e personalize as páginas da sua loja
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/storefront/builder?edit=home')}>
              <Pencil className="h-4 w-4 mr-2" />
              Abrir Editor
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  Clique em "Abrir Editor" para editar páginas. 
                  Use esta tela para gerenciar status e ver detalhes.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {templatesLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
        <>
          {/* E-commerce Templates */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <span className="text-xl">🛒</span>
                </div>
                <div>
                  <CardTitle className="text-lg">E-commerce (Páginas Padrão)</CardTitle>
                  <CardDescription>
                    Templates fixos do e-commerce — não podem ser excluídos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border rounded-lg border">
                {(Object.keys(pageTypeInfo) as PageType[])
                  .map((pageType) => {
                  const info = pageTypeInfo[pageType];
                  const template = templates?.find(t => t.page_type === pageType);
                  const hasPublished = !!template?.published_version;
                  const hasDraft = !!template?.draft_version;
                  const lastUpdated = template?.updated_at;

                  return (
                    <div 
                      key={pageType} 
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{info.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{info.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {info.description}
                            {lastUpdated && (
                              <span className="ml-2">
                                · {format(new Date(lastUpdated), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {hasPublished ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Publicado
                          </Badge>
                        ) : hasDraft ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            Rascunho
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Não editado
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          <Button
                            onClick={() => navigate(`/storefront/builder?edit=${pageType}`)}
                            variant="ghost"
                            size="sm"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (primaryOrigin) {
                                    const previewPath = getPreviewUrl(pageType);
                                    const absoluteUrl = buildPublicStorefrontUrl(primaryOrigin, previewPath);
                                    window.open(absoluteUrl, '_blank');
                                  }
                                }}
                                disabled={!primaryOrigin}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Prévia</TooltipContent>
                          </Tooltip>
                          {hasPublished && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(getPublicHomeUrl(currentTenant?.slug || ''), '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver publicado</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
        )}
      </div>
    </TooltipProvider>
  );
}
