// =============================================
// VISUAL BUILDER - Main builder component
// =============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBuilderStore } from '@/hooks/useBuilderStore';
import { useBuilderData } from '@/hooks/useBuilderData';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { isEssentialBlock, getEssentialBlockReason } from '@/lib/builder/essentialBlocks';
import { BuilderToolbar } from './BuilderToolbar';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockPalette } from './BlockPalette';
import { BlockTree } from './BlockTree';
import { PropsEditor } from './PropsEditor';
import { HeaderFooterPropsEditor } from './HeaderFooterPropsEditor';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { CategorySettingsPanel, useCategorySettings } from './CategorySettingsPanel';
import { ProductSettingsPanel, useProductSettings } from './ProductSettingsPanel';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, LayoutGrid } from 'lucide-react';
import { 
  useGlobalLayoutForEditor, 
  applyGlobalLayout, 
  extractHeaderFooter 
} from '@/hooks/useGlobalLayoutIntegration';
import { usePageOverrides } from '@/hooks/usePageOverrides';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

interface VisualBuilderProps {
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'institutional' | 'landing_page' | 'tracking' | 'blog';
  pageId?: string;
  pageTitle?: string;
  pageSlug?: string; // For institutional/landing pages
  initialContent?: BlockNode;
  context: BlockRenderContext;
}

export function VisualBuilder({
  tenantId,
  pageType,
  pageId,
  pageTitle,
  pageSlug,
  initialContent,
  context,
}: VisualBuilderProps) {
  const navigate = useNavigate();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isInteractMode, setIsInteractMode] = useState(false);
  const [leftTab, setLeftTab] = useState<'blocks' | 'tree'>('blocks');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [canvasViewport, setCanvasViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  // Example selectors state (for Product/Category templates)
  const [exampleProductId, setExampleProductId] = useState<string>('');
  const [exampleCategoryId, setExampleCategoryId] = useState<string>('');

  // Check page context for Header/Footer governance
  const isCheckoutPage = pageType === 'checkout';
  const isHomePage = pageType === 'home';
  const isCategoryPage = pageType === 'category';
  const isProductPage = pageType === 'product';

  // Category settings for category template
  const { settings: categorySettings, setSettings: setCategorySettings } = useCategorySettings(tenantId);

  // Product settings for product template
  const { settings: productSettings, setSettings: setProductSettings } = useProductSettings(tenantId);

  // Fetch full category data (including banners) when editing category template
  const { data: selectedCategory } = useQuery({
    queryKey: ['builder-category-full', exampleCategoryId],
    queryFn: async () => {
      if (!exampleCategoryId) return null;
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, description, image_url, banner_desktop_url, banner_mobile_url')
        .eq('id', exampleCategoryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!exampleCategoryId && isCategoryPage,
  });

  // Global layout integration
  const { 
    globalLayout, 
    isLoading: layoutLoading,
    updateGlobalHeader,
    updateGlobalFooter,
    updateCheckoutHeader,
    updateCheckoutFooter,
    migrateFromHome,
  } = useGlobalLayoutForEditor(tenantId);

  // Page overrides for non-home/non-checkout pages
  const { overrides: pageOverrides, isLoading: overridesLoading } = usePageOverrides({
    tenantId,
    pageType,
    pageId,
  });

  // Run migration on first load if needed
  useEffect(() => {
    if (globalLayout?.needsMigration && !layoutLoading) {
      migrateFromHome.mutate();
    }
  }, [globalLayout?.needsMigration, layoutLoading]);

  // Get initial content from prop or default template
  const startingContent = useMemo(() => 
    initialContent || getDefaultTemplate(pageType),
    [initialContent, pageType]
  );

  // Apply global layout to initial content for display (non-checkout pages)
  // Also apply page overrides for non-home pages
  const contentWithGlobalLayout = useMemo(() => {
    if (!globalLayout || isCheckoutPage) return startingContent;
    // For home page, no overrides; for other pages, apply overrides
    const overridesToApply = isHomePage ? null : pageOverrides;
    return applyGlobalLayout(startingContent, globalLayout, isCheckoutPage, overridesToApply);
  }, [startingContent, globalLayout, isCheckoutPage, isHomePage, pageOverrides]);

  // Builder store for state management
  const store = useBuilderStore(contentWithGlobalLayout);

  // Sync content when template or global layout changes
  useEffect(() => {
    if (!layoutLoading && !overridesLoading) {
      store.setContent(contentWithGlobalLayout);
    }
  }, [pageType, contentWithGlobalLayout, layoutLoading, overridesLoading]);

  // Data mutations
  const { saveDraft, publish } = useBuilderData(tenantId);

  // Build category header slot (banner + name) for afterHeaderSlot
  // Use context.viewport to determine which image to show in the editor
  const categoryHeaderSlot = useMemo(() => {
    if (!isCategoryPage || !selectedCategory) return undefined;
    
    const showBanner = categorySettings.showBanner !== false;
    const showName = categorySettings.showCategoryName !== false;
    
    const bannerDesktop = selectedCategory.banner_desktop_url;
    const bannerMobile = selectedCategory.banner_mobile_url;
    const hasBanner = showBanner && (bannerDesktop || bannerMobile);

    // In editor, use lifted viewport state to pick the correct image
    const isMobileView = canvasViewport === 'mobile';
    
    // Determine which image to show based on viewport
    const imageToShow = isMobileView
      ? (bannerMobile || bannerDesktop)
      : (bannerDesktop || bannerMobile);
    
    // If nothing to show, return undefined
    if (!hasBanner && !showName) return undefined;
    
    return (
      <div className="w-full">
        {hasBanner && imageToShow && (
          <img
            src={imageToShow}
            alt={`Banner ${selectedCategory.name || 'Categoria'}`}
            className="w-full h-auto object-cover"
          />
        )}
        {showName && selectedCategory.name && (
          <h1 className="text-2xl md:text-3xl font-bold text-foreground px-4 py-6 text-center bg-background">
            {selectedCategory.name}
          </h1>
        )}
      </div>
    );
  }, [isCategoryPage, selectedCategory, categorySettings.showBanner, categorySettings.showCategoryName, canvasViewport]);

  // Build context with example data - include proper category object for builder
  const builderContext = useMemo<BlockRenderContext>(() => {
    const ctx: BlockRenderContext = { 
      ...context, 
      viewport: canvasViewport,
      pageType: pageType as BlockRenderContext['pageType'], // Pass pageType for essential block detection
    };
    
    // For Category template, add category context with the selected example
    if (pageType === 'category' && selectedCategory) {
      ctx.category = { 
        id: selectedCategory.id, 
        name: selectedCategory.name,
        slug: selectedCategory.slug,
        description: selectedCategory.description || undefined,
        image_url: selectedCategory.image_url || undefined,
        banner_desktop_url: selectedCategory.banner_desktop_url || undefined,
        banner_mobile_url: selectedCategory.banner_mobile_url || undefined,
      };
      // Add category header slot (banner + name)
      ctx.afterHeaderSlot = categoryHeaderSlot;
    }
    
    // For Product template, add product settings to context
    if (pageType === 'product') {
      (ctx as any).productSettings = productSettings;
    }
    
    return ctx;
  }, [context, pageType, selectedCategory, categoryHeaderSlot, canvasViewport, productSettings]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (store.isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [store.isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          store.undo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          store.redo();
        } else if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedBlockId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleDeleteBlock();
        }
      }
      if (e.key === 'Escape') {
        store.selectBlock(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store.selectedBlockId]);

  // Handle adding a new block (with optional parent and index for canvas insertion)
  const handleAddBlock = useCallback((type: string, parentId?: string, index?: number) => {
    // Use provided parentId, or selected block, or root content id as fallback
    const targetParentId = parentId || store.selectedBlockId || store.content.id;
    store.addBlock(type, targetParentId, index);
    toast.success(`Bloco "${blockRegistry.get(type)?.label || type}" adicionado`);
  }, [store]);

  // Determine entity type based on pageType
  const entityType = (pageType === 'institutional' || pageType === 'landing_page') ? 'page' : 'template';

  // Handle saving draft - save global Header/Footer ONLY from Home page
  const handleSave = useCallback(async () => {
    try {
      // Extract Header/Footer from current content
      const { header, footer } = extractHeaderFooter(store.content);
      
      // GOVERNANCE: Only save global Header/Footer from Home page
      // Checkout has its own separate layout
      // Other pages CANNOT modify global layout
      if (isHomePage) {
        // Home page: save to global layout
        if (header) {
          await updateGlobalHeader.mutateAsync(header);
        }
        if (footer) {
          await updateGlobalFooter.mutateAsync(footer);
        }
      } else if (isCheckoutPage) {
        // Checkout: save to checkout-specific layout
        if (header) {
          await updateCheckoutHeader.mutateAsync(header);
        }
        if (footer) {
          await updateCheckoutFooter.mutateAsync(footer);
        }
      }
      // Other pages: DO NOT save Header/Footer to global (blocked by governance)

      // Save the page content (without Header/Footer for non-checkout, or with them for checkout)
      // For non-checkout pages, we strip Header/Footer from saved content since they're global
      let contentToSave = store.content;
      if (!isCheckoutPage && store.content.children) {
        contentToSave = {
          ...store.content,
          children: store.content.children.filter(
            child => child.type !== 'Header' && child.type !== 'Footer'
          ),
        };
      }

      await saveDraft.mutateAsync({
        entityType,
        pageType: entityType === 'template' ? pageType : undefined,
        pageId: entityType === 'page' ? pageId : undefined,
        content: contentToSave,
      });
      store.markClean();
      toast.success('Rascunho salvo!');
    } catch (error) {
      toast.error('Erro ao salvar rascunho');
    }
  }, [saveDraft, entityType, pageType, pageId, store, isHomePage, isCheckoutPage, updateGlobalHeader, updateGlobalFooter, updateCheckoutHeader, updateCheckoutFooter]);

  // Handle publishing - same governance as save
  const handlePublish = useCallback(async () => {
    try {
      // Extract Header/Footer from current content
      const { header, footer } = extractHeaderFooter(store.content);
      
      // GOVERNANCE: Only save global Header/Footer from Home page
      if (isHomePage) {
        if (header) {
          await updateGlobalHeader.mutateAsync(header);
        }
        if (footer) {
          await updateGlobalFooter.mutateAsync(footer);
        }
      } else if (isCheckoutPage) {
        if (header) {
          await updateCheckoutHeader.mutateAsync(header);
        }
        if (footer) {
          await updateCheckoutFooter.mutateAsync(footer);
        }
      }
      // Other pages: DO NOT save Header/Footer to global (blocked by governance)

      // Save the page content (without Header/Footer for non-checkout)
      let contentToSave = store.content;
      if (!isCheckoutPage && store.content.children) {
        contentToSave = {
          ...store.content,
          children: store.content.children.filter(
            child => child.type !== 'Header' && child.type !== 'Footer'
          ),
        };
      }

      await publish.mutateAsync({
        entityType,
        pageType: entityType === 'template' ? pageType : undefined,
        pageId: entityType === 'page' ? pageId : undefined,
        content: contentToSave,
      });
      store.markClean();
      toast.success('Página publicada com sucesso!');
    } catch (error) {
      toast.error('Erro ao publicar página');
    }
  }, [publish, entityType, pageType, pageId, store, isHomePage, isCheckoutPage, updateGlobalHeader, updateGlobalFooter, updateCheckoutHeader, updateCheckoutFooter]);

  // Handle deleting selected block
  const handleDeleteBlock = useCallback(() => {
    if (!store.selectedBlockId) return;
    const def = store.selectedBlockDefinition;
    if (def?.isRemovable === false) {
      toast.error('Este bloco não pode ser removido');
      return;
    }
    store.removeBlock(store.selectedBlockId);
    toast.success('Bloco removido');
  }, [store]);

  // Handle duplicating selected block
  const handleDuplicateBlock = useCallback(() => {
    if (!store.selectedBlockId) return;
    store.duplicateBlock(store.selectedBlockId);
    toast.success('Bloco duplicado');
  }, [store]);

  // Handle props change
  const handlePropsChange = useCallback((props: Record<string, unknown>) => {
    if (!store.selectedBlockId) return;
    store.updateProps(store.selectedBlockId, props);
  }, [store]);

  // Handle reset to default - uses getDefaultTemplate as single source of truth
  const handleReset = useCallback(() => {
    // Get the default template for this page type
    let defaultContent = getDefaultTemplate(pageType);
    
    // Apply global layout to the default template (for non-checkout pages)
    if (globalLayout && !isCheckoutPage) {
      defaultContent = applyGlobalLayout(defaultContent, globalLayout, isCheckoutPage, null);
    }
    
    store.setContent(defaultContent);
    toast.success('Template restaurado para o padrão');
  }, [pageType, store, globalLayout, isCheckoutPage]);

  // Handle moving block (from tree drag and drop)
  const handleMoveBlock = useCallback((blockId: string, newParentId: string, newIndex: number) => {
    store.moveBlock(blockId, newParentId, newIndex);
  }, [store]);

  // Handle moving block by direction (for quick actions on canvas)
  const handleMoveBlockByDirection = useCallback((blockId: string, direction: 'up' | 'down') => {
    const { findParentBlock, findBlockById } = require('@/lib/builder/utils');
    const parent = findParentBlock(store.content, blockId);
    if (!parent || !parent.children) return;
    
    const currentIndex = parent.children.findIndex((c: BlockNode) => c.id === blockId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= parent.children.length) return;
    
    store.moveBlock(blockId, parent.id, newIndex);
  }, [store]);

  // Handle duplicating a specific block (for quick actions)
  const handleDuplicateBlockById = useCallback((blockId: string) => {
    store.duplicateBlock(blockId);
    toast.success('Bloco duplicado');
  }, [store]);

  // Handle deleting a specific block (for quick actions)
  const handleDeleteBlockById = useCallback((blockId: string) => {
    const { findBlockById } = require('@/lib/builder/utils');
    const block = findBlockById(store.content, blockId);
    if (!block) return;
    
    // Check registry isRemovable
    const def = blockRegistry.get(block.type);
    if (def?.isRemovable === false) {
      toast.error('Este bloco não pode ser removido');
      return;
    }
    
    // Check if it's an essential block for this page type
    if (isEssentialBlock(block.type, pageType)) {
      const reason = getEssentialBlockReason(block.type, pageType);
      toast.error(reason || 'Este bloco é essencial para este template e não pode ser removido');
      return;
    }
    
    store.removeBlock(blockId);
    toast.success('Bloco removido');
  }, [store, pageType]);

  // Handle toggling block visibility (for quick actions)
  const handleToggleHidden = useCallback((blockId: string) => {
    store.toggleHidden(blockId);
    const { findBlockById } = require('@/lib/builder/utils');
    const block = findBlockById(store.content, blockId);
    toast.success(block?.hidden ? 'Bloco ocultado' : 'Bloco visível');
  }, [store]);

  // Scroll to block in canvas
  const handleScrollToBlock = useCallback((blockId: string) => {
    const element = document.querySelector(`[data-block-id="${blockId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Go back
  const handleBack = useCallback(() => {
    if (store.isDirty) {
      if (!confirm('Você tem alterações não salvas. Deseja sair?')) {
        return;
      }
    }
    navigate('/storefront/builder');
  }, [navigate, store.isDirty]);

  const pageTypeLabels: Record<string, string> = {
    home: 'Página Inicial',
    category: 'Categoria',
    product: 'Produto',
    cart: 'Carrinho',
    checkout: 'Checkout',
    institutional: pageTitle || 'Página',
    landing_page: pageTitle || 'Landing Page',
  };

  // DnD sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 10 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Dragging state for overlay
  const [draggingBlockType, setDraggingBlockType] = useState<string | null>(null);

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={(event) => {
        const blockType = event.active.data.current?.blockType;
        if (blockType) {
          setDraggingBlockType(blockType);
        }
      }}
      onDragEnd={() => {
        setDraggingBlockType(null);
      }}
      onDragCancel={() => {
        setDraggingBlockType(null);
      }}
    >
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Toolbar */}
      <BuilderToolbar
        pageTitle={pageTypeLabels[pageType] || pageType}
        pageType={pageType}
        tenantSlug={context.tenantSlug}
        pageSlug={pageSlug}
        isDirty={store.isDirty}
        isPreviewMode={isPreviewMode}
        isInteractMode={isInteractMode}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        isSaving={saveDraft.isPending}
        isPublishing={publish.isPending}
        onUndo={store.undo}
        onRedo={store.redo}
        onSave={handleSave}
        onPublish={handlePublish}
        onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
        onToggleInteract={() => setIsInteractMode(!isInteractMode)}
        onReset={handleReset}
        onViewHistory={() => setShowVersionHistory(true)}
        onBack={handleBack}
        exampleProductId={exampleProductId}
        exampleCategoryId={exampleCategoryId}
        onExampleCategoryChange={setExampleCategoryId}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Block Palette + Tree */}
        {!isPreviewMode && (
          <div className="w-64 flex-shrink-0 border-r bg-background flex flex-col shadow-sm">
            {/* Category Settings Panel - Only for Category template */}
            {isCategoryPage && (
              <CategorySettingsPanel
                tenantId={tenantId}
                settings={categorySettings}
                onChange={setCategorySettings}
              />
            )}
            
            {/* Product Settings Panel - Only for Product template */}
            {isProductPage && (
              <ProductSettingsPanel
                tenantId={tenantId}
                settings={productSettings}
                onChange={setProductSettings}
              />
            )}
            
            <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as 'blocks' | 'tree')} className="flex flex-col h-full">
              <TabsList className="w-full justify-start rounded-none border-b bg-background px-2 py-0 h-11">
                <TabsTrigger 
                  value="blocks" 
                  className="gap-1.5 data-[state=active]:bg-primary/10 rounded-md px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>Blocos</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="tree" 
                  className="gap-1.5 data-[state=active]:bg-primary/10 rounded-md px-3"
                >
                  <Layers className="h-4 w-4" />
                  <span>Estrutura</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="blocks" className="flex-1 m-0 overflow-hidden">
                <BlockPalette onAddBlock={handleAddBlock} />
              </TabsContent>
              
              <TabsContent value="tree" className="flex-1 m-0 overflow-hidden">
                <BlockTree
                  content={store.content}
                  selectedBlockId={store.selectedBlockId}
                  onSelectBlock={store.selectBlock}
                  onMoveBlock={handleMoveBlock}
                  onScrollToBlock={handleScrollToBlock}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Center - Canvas */}
        <div className="flex-1 overflow-hidden">
          <BuilderCanvas
            content={store.content}
            context={builderContext}
            selectedBlockId={store.selectedBlockId}
            onSelectBlock={store.selectBlock}
            onAddBlock={handleAddBlock}
            onMoveBlock={handleMoveBlockByDirection}
            onDuplicateBlock={handleDuplicateBlockById}
            onDeleteBlock={handleDeleteBlockById}
            onToggleHidden={handleToggleHidden}
            isPreviewMode={isPreviewMode}
            isInteractMode={isInteractMode}
            viewport={canvasViewport}
            onViewportChange={setCanvasViewport}
          />
        </div>

        {/* Right Sidebar - Props Editor */}
        {!isPreviewMode && (
          <div className="w-80 flex-shrink-0 bg-background shadow-sm">
            {store.selectedBlock && store.selectedBlockDefinition ? (
              // Use specialized editor for Header/Footer blocks (governance)
              store.selectedBlock.type === 'Header' || store.selectedBlock.type === 'Footer' ? (
                <HeaderFooterPropsEditor
                  definition={store.selectedBlockDefinition}
                  props={store.selectedBlock.props}
                  onChange={handlePropsChange}
                  onDelete={handleDeleteBlock}
                  onDuplicate={handleDuplicateBlock}
                  canDelete={store.selectedBlockDefinition.isRemovable !== false}
                  isHomePage={isHomePage}
                  isCheckoutPage={isCheckoutPage}
                  blockType={store.selectedBlock.type as 'Header' | 'Footer'}
                  tenantId={tenantId}
                  pageType={pageType}
                  pageId={pageId}
                />
              ) : (
                <PropsEditor
                  definition={store.selectedBlockDefinition}
                  props={store.selectedBlock.props}
                  onChange={handlePropsChange}
                  onDelete={handleDeleteBlock}
                  onDuplicate={handleDuplicateBlock}
                  canDelete={store.selectedBlockDefinition.isRemovable !== false}
                />
              )
            ) : (
              <div className="h-full flex items-center justify-center p-6 border-l">
                <div className="text-center text-muted-foreground">
                  <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum bloco selecionado</p>
                  <p className="text-xs mt-1">Clique em um bloco no canvas para editar suas propriedades</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Version History Dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        entityType={entityType}
        pageId={entityType === 'page' ? pageId : undefined}
        pageType={entityType === 'template' ? pageType as 'home' | 'category' | 'product' | 'cart' | 'checkout' : undefined}
        onRestore={(content) => store.setContent(content)}
      />

      {/* Drag Overlay */}
      <DragOverlay>
        {draggingBlockType && (
          <div className="bg-primary text-primary-foreground px-3 py-2 rounded-md shadow-lg text-sm font-medium">
            {blockRegistry.get(draggingBlockType)?.label || draggingBlockType}
          </div>
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
}
