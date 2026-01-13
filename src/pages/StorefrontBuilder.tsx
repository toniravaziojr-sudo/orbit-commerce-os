// =============================================
// STOREFRONT BUILDER PAGE - Visual Editor page
// =============================================

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useTemplateVersion } from '@/hooks/useBuilderData';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildMenuItemUrl } from '@/lib/publicUrls';
import BuilderErrorBoundary from '@/components/builder/BuilderErrorBoundary';
import { getReactGuardStatus } from '@/lib/reactInstanceGuard';
import { getBlankTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'tracking' | 'blog';

// Isolation modes for debugging React #300
type IsolateMode = 'app' | 'visual' | 'canvas' | 'blocks' | 'blocks-real' | 'full';

// Isolation mode component - renders minimal content for each isolation level
function IsolationModeUI({ mode, reactStatus }: { mode: IsolateMode; reactStatus: ReturnType<typeof getReactGuardStatus> }) {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            🔬 Modo de Isolamento: <code className="bg-blue-500/20 px-2 py-1 rounded">{mode}</code>
          </h1>
          <p className="text-muted-foreground text-sm">
            Se você está vendo esta tela SEM erro, o problema está em uma camada posterior.
          </p>
        </div>

        {/* React Instance Status */}
        <div className={`border rounded-lg p-4 ${reactStatus.ok ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <h2 className="font-semibold mb-2">React Instance Guard</h2>
          <div className="text-sm font-mono space-y-1">
            <p>Status: {reactStatus.ok ? '✅ OK' : '❌ PROBLEMA'}</p>
            <p>Versão: {reactStatus.version}</p>
            <p>Múltiplas instâncias: {reactStatus.multipleInstances ? '⚠️ SIM' : 'Não'}</p>
            {reactStatus.versions.length > 1 && (
              <p>Versões detectadas: {reactStatus.versions.join(', ')}</p>
            )}
          </div>
        </div>

        {/* Isolation levels explanation */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Níveis de Isolamento</h2>
          <ul className="text-sm space-y-2">
            <li className={mode === 'app' ? 'font-bold text-primary' : 'text-muted-foreground'}>
              <code>?isolate=app</code> — Apenas StorefrontBuilder (sem VisualBuilder)
            </li>
            <li className={mode === 'visual' ? 'font-bold text-primary' : 'text-muted-foreground'}>
              <code>?isolate=visual</code> — VisualBuilder shell (sem DnD/Canvas)
            </li>
            <li className={mode === 'canvas' ? 'font-bold text-primary' : 'text-muted-foreground'}>
              <code>?isolate=canvas</code> — Canvas (sem BlockRenderer)
            </li>
            <li className={mode === 'blocks' ? 'font-bold text-primary' : 'text-muted-foreground'}>
              <code>?isolate=blocks</code> — BlockRenderer com bloco simples
            </li>
            <li className={mode === 'blocks-real' ? 'font-bold text-primary' : 'text-muted-foreground'}>
              <code>?isolate=blocks-real&blockIndex=0</code> — Blocos reais um a um
            </li>
            <li className={mode === 'full' ? 'font-bold text-primary' : 'text-muted-foreground'}>
              <code>?isolate=full</code> ou sem param — Render normal
            </li>
          </ul>
        </div>

        {/* Test buttons */}
        <div className="flex flex-wrap gap-2">
          {(['app', 'visual', 'canvas', 'blocks', 'blocks-real', 'full'] as IsolateMode[]).map((level) => (
            <a
              key={level}
              href={level === 'blocks-real' ? `?edit=home&isolate=${level}&blockIndex=0` : `?edit=home&isolate=${level}`}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                mode === level 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {level}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const { currentTenant, isLoading: authLoading } = useAuth();
  const { settings: storeSettings, isLoading: settingsLoading } = useStoreSettings();
  
  const editingPageType = searchParams.get('edit') as PageType | null;
  const isolateMode = searchParams.get('isolate') as IsolateMode | null;
  const isBlankStart = searchParams.get('blank') === 'true';
  
  // Get React guard status for diagnostics
  const reactStatus = getReactGuardStatus();
  
  // ISOLATION MODE: If ?isolate=app, render minimal UI to test this layer
  if (isolateMode === 'app') {
    return <IsolationModeUI mode="app" reactStatus={reactStatus} />;
  }
  
  // If no edit parameter, redirect to storefront settings page
  if (!editingPageType) {
    // Use useEffect to avoid navigation during render
    setTimeout(() => navigate('/storefront', { replace: true }), 0);
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }
  
  // Check if editing a system page (tracking or blog)
  const isSystemPage = editingPageType === 'tracking' || editingPageType === 'blog';
  const systemPageSlug = editingPageType === 'tracking' ? 'rastreio' : editingPageType === 'blog' ? 'blog' : null;
  
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
    !isSystemPage ? editingPageType : 'home', 
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
  const getMenuItemUrl = (item: any): string => {
    if (!currentTenant) return '';
    return buildMenuItemUrl(currentTenant.slug, item, categoriesData || [], pagesData || []);
  };

  // Show loading while auth is loading
  if (authLoading || !currentTenant) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
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
      <BuilderErrorBoundary>
        <VisualBuilder
          tenantId={currentTenant.id}
          pageType={editingPageType}
          pageId={systemPageData.id}
          pageTitle={pageTypeInfo[editingPageType]?.title}
          pageSlug={systemPageSlug || undefined}
          initialContent={systemPageData.content as unknown as BlockNode | undefined}
          context={context}
          isolateMode={isolateMode || undefined}
        />
      </BuilderErrorBoundary>
    );
  }

  // For regular templates - use blank template if starting from scratch
  const contentToUse = isBlankStart 
    ? getBlankTemplate(editingPageType) 
    : templateData?.content;

  return (
    <BuilderErrorBoundary>
      <VisualBuilder
        tenantId={currentTenant.id}
        pageType={editingPageType}
        initialContent={contentToUse}
        context={context}
        isolateMode={isolateMode || undefined}
      />
    </BuilderErrorBoundary>
  );
}
