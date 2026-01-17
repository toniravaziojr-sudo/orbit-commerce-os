// =============================================
// VISUAL BUILDER - Main builder component
// =============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBuilderStore } from '@/hooks/useBuilderStore';
import { useBuilderData } from '@/hooks/useBuilderData';
import { useTemplateSetSave } from '@/hooks/useTemplateSetSave';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { canDeleteBlock, getRequiredBlockInfo } from '@/lib/builder/pageContracts';
import { isEssentialBlock, getEssentialBlockReason } from '@/lib/builder/essentialBlocks';
import { findBlockById } from '@/lib/builder/utils';
import { BuilderToolbar } from './BuilderToolbar';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockRenderer } from './BlockRenderer';
import { BuilderSidebar } from './BuilderSidebar';
import { AddBlockDrawer } from './AddBlockDrawer';
import { ThemeSettingsPanel } from './ThemeSettingsPanel';
import { PropsEditor } from './PropsEditor';
import { HeaderFooterPropsEditor } from './HeaderFooterPropsEditor';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { CategorySettingsPanel, useCategorySettings } from './CategorySettingsPanel';
import { ProductSettingsPanel, useProductSettings } from './ProductSettingsPanel';
import { useCartSettings } from './CartSettingsPanel';
import { useCheckoutSettings } from './CheckoutSettingsPanel';
import { useThankYouSettings } from './ThankYouSettingsPanel';
import { BuilderDebugPanel, DebugQueryState, addSupabaseError } from './BuilderDebugPanel';
// MiniCartPreview is now rendered inside BuilderCanvas
import { toast } from 'sonner';
import { LayoutGrid } from 'lucide-react';
import { 
  useGlobalLayoutForEditor, 
  applyGlobalLayout, 
  extractHeaderFooter 
} from '@/hooks/useGlobalLayoutIntegration';
import { usePageOverrides } from '@/hooks/usePageOverrides';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

// Isolation modes for debugging React #300
type IsolateMode = 'app' | 'visual' | 'canvas' | 'blocks' | 'blocks-real' | 'full';

interface VisualBuilderProps {
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'institutional' | 'landing_page' | 'tracking' | 'blog' | 'page_template';
  pageId?: string;
  pageTitle?: string;
  pageSlug?: string; // For institutional/landing pages
  initialContent?: BlockNode;
  context: BlockRenderContext;
  isolateMode?: IsolateMode;
  templateSetId?: string; // For multi-template system
}

// Minimal isolation UI for visual/canvas/blocks modes
function VisualIsolationUI({ mode, message }: { mode: string; message: string }) {
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          🔬 Isolamento: <code className="bg-blue-500/20 px-2 py-0.5 rounded">{mode}</code> — {message}
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center bg-muted/50">
        <div className="text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-xl font-bold text-green-600">Camada OK</h2>
          <p className="text-muted-foreground max-w-md">
            Se você está vendo isso SEM erro, o problema está em uma camada posterior.
            Teste o próximo nível.
          </p>
          <div className="flex gap-2 justify-center">
            <a href="?edit=home&isolate=visual" className="px-3 py-1.5 text-sm bg-muted rounded hover:bg-muted/80">visual</a>
            <a href="?edit=home&isolate=canvas" className="px-3 py-1.5 text-sm bg-muted rounded hover:bg-muted/80">canvas</a>
            <a href="?edit=home&isolate=blocks" className="px-3 py-1.5 text-sm bg-muted rounded hover:bg-muted/80">blocks</a>
            <a href="?edit=home&isolate=full" className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90">full</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisualBuilder({
  tenantId,
  pageType,
  pageId,
  pageTitle,
  pageSlug,
  initialContent,
  context,
  isolateMode,
  templateSetId,
}: VisualBuilderProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Safe Mode: ?safe=1 renders placeholders only (for debugging)
  const isSafeMode = searchParams.get('safe') === '1';
  const isDebugMode = searchParams.get('debug') === '1';
  
  // All hooks must be called before any conditional returns
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isInteractMode, setIsInteractMode] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showAddBlockDrawer, setShowAddBlockDrawer] = useState(false);
  
// AJUSTE 2: Preserve theme settings panel state via URL param
  // This prevents the panel from closing when navigating between pages
  const themeSettingsFromUrl = searchParams.get('settings') === 'theme';
  const [showThemeSettings, setShowThemeSettingsInternal] = useState(themeSettingsFromUrl);
  
  // Mini-cart preview state via URL param
  const miniCartPreviewFromUrl = searchParams.get('miniCartPreview') === '1';
  const [showMiniCartPreview, setShowMiniCartPreviewInternal] = useState(miniCartPreviewFromUrl);
  
  // Mini-cart config state - updated by MiniCartSettings
  const [miniCartConfig, setMiniCartConfig] = useState<import('./theme-settings/MiniCartSettings').MiniCartConfig | undefined>();
  
  // Sync URL with theme settings state
  const setShowThemeSettings = useCallback((open: boolean) => {
    setShowThemeSettingsInternal(open);
    const url = new URL(window.location.href);
    if (open) {
      url.searchParams.set('settings', 'theme');
    } else {
      url.searchParams.delete('settings');
    }
    // Replace state without full navigation to avoid re-mount
    window.history.replaceState({}, '', url.toString());
  }, []);
  
  // Sync URL with mini-cart preview state
  const setShowMiniCartPreview = useCallback((open: boolean) => {
    setShowMiniCartPreviewInternal(open);
    const url = new URL(window.location.href);
    if (open) {
      url.searchParams.set('miniCartPreview', '1');
    } else {
      url.searchParams.delete('miniCartPreview');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);
  
  // Sync from URL on mount/change
  useEffect(() => {
    setShowThemeSettingsInternal(themeSettingsFromUrl);
  }, [themeSettingsFromUrl]);
  
  // Auto-close mini-cart preview when not in mini-cart settings
  const settingsView = searchParams.get('settingsView');
  const isInMiniCartSettings = themeSettingsFromUrl && settingsView === 'miniCart';
  
  useEffect(() => {
    // Only show mini-cart preview when inside mini-cart settings
    if (miniCartPreviewFromUrl && !isInMiniCartSettings) {
      // Clean up URL and close preview
      setShowMiniCartPreview(false);
    } else if (isInMiniCartSettings) {
      setShowMiniCartPreviewInternal(true);
    } else {
      setShowMiniCartPreviewInternal(miniCartPreviewFromUrl);
    }
  }, [miniCartPreviewFromUrl, isInMiniCartSettings, setShowMiniCartPreview]);
  
  const [canvasViewport, setCanvasViewport] = useState<'desktop' | 'mobile'>('desktop');
  
  // Example selectors state (for Product/Category templates)
  const [exampleProductId, setExampleProductId] = useState<string>('');
  const [exampleCategoryId, setExampleCategoryId] = useState<string>('');

  // Check page context for Header/Footer governance
  const isCheckoutPage = pageType === 'checkout';
  const isHomePage = pageType === 'home';
  const isCategoryPage = pageType === 'category';
  const isProductPage = pageType === 'product';

  // Category settings for category template - pass templateSetId for real-time updates
  const { settings: categorySettings, setSettings: setCategorySettings } = useCategorySettings(tenantId, templateSetId);

  // Product settings for product template - pass templateSetId for real-time updates
  const { settings: productSettings, setSettings: setProductSettings } = useProductSettings(tenantId, templateSetId);

  // Cart settings for cart template - pass templateSetId for real-time updates
  const { settings: cartSettings } = useCartSettings(tenantId, templateSetId);

  // Checkout settings for checkout template - pass templateSetId for real-time updates
  const { settings: checkoutSettings } = useCheckoutSettings(tenantId, templateSetId);

  // Thank you settings for thank_you template - pass templateSetId for real-time updates
  const { settings: thankYouSettings } = useThankYouSettings(tenantId, templateSetId);

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
    // isEditing=true so header/footer always appear in builder (with hidden prop if disabled)
    // Pass pageType to filter duplicate blocks (e.g., CompreJuntoSlot, ProductGrid on product pages)
    return applyGlobalLayout(startingContent, globalLayout, isCheckoutPage, overridesToApply, true, pageType);
  }, [startingContent, globalLayout, isCheckoutPage, isHomePage, pageOverrides, pageType]);

  // Builder store for state management
  const store = useBuilderStore(contentWithGlobalLayout);

  // Data mutations - legacy system
  const { saveDraft, publish } = useBuilderData(tenantId);
  
  // Data mutations - new multi-template system
  const { saveDraft: saveTemplateSetDraft, publishTemplateSet } = useTemplateSetSave();

  // NOTA: O CategoryBannerBlock (bloco obrigatório do template) é responsável por renderizar
  // o banner e título da categoria. Não precisamos de um categoryHeaderSlot separado
  // pois isso causaria duplicação. O CategoryBannerBlock lê category.banner_*_url do context.
  const categoryHeaderSlot = undefined;

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
    
    // For Category template, add category settings to context
    // REGRAS.md: categorySettings devem refletir no builder imediatamente
    if (pageType === 'category') {
      (ctx as any).categorySettings = categorySettings;
    }
    
    // For Product template, add product settings to context
    if (pageType === 'product') {
      (ctx as any).productSettings = productSettings;
    }
    
    // For Cart template, add cart settings to context
    if (pageType === 'cart') {
      (ctx as any).cartSettings = cartSettings;
    }
    
    // For Checkout template, add checkout settings to context
    if (pageType === 'checkout') {
      (ctx as any).checkoutSettings = checkoutSettings;
    }
    
    // For Thank You template, add thank you settings to context
    if (pageType === 'thank_you') {
      (ctx as any).thankYouSettings = thankYouSettings;
    }
    
    return ctx;
  }, [context, pageType, selectedCategory, categoryHeaderSlot, canvasViewport, productSettings, categorySettings, cartSettings, checkoutSettings, thankYouSettings]);

  // Debug log on mount
  useEffect(() => {
    console.log('[VisualBuilder] Mounted with:', { tenantId, pageType, pageId, hasInitialContent: !!initialContent, isSafeMode, isDebugMode, isolateMode });
  }, [tenantId, pageType, pageId, initialContent, isSafeMode, isDebugMode, isolateMode]);

  // Run migration on first load if needed
  useEffect(() => {
    if (globalLayout?.needsMigration && !layoutLoading) {
      migrateFromHome.mutate();
    }
  }, [globalLayout?.needsMigration, layoutLoading, migrateFromHome]);

  // Sync content when template or global layout changes
  // When globalLayout changes (header/footer settings), we need to update those blocks
  // even if isDirty, but preserve other user changes
  useEffect(() => {
    if (!layoutLoading && !overridesLoading) {
      if (store.isDirty) {
        // When dirty, only update header/footer blocks from globalLayout
        // to reflect settings changes without losing user's other edits
        const currentContent = store.content;
        if (currentContent?.children && globalLayout) {
          const updatedChildren = currentContent.children.map(child => {
            if (child.type === 'Header') {
              return { ...globalLayout.header_config, id: child.id, hidden: child.hidden };
            }
            if (child.type === 'Footer') {
              return { ...globalLayout.footer_config, id: child.id, hidden: child.hidden };
            }
            return child;
          });
          // Only update if header/footer actually changed
          const hasChanges = JSON.stringify(currentContent.children) !== JSON.stringify(updatedChildren);
          if (hasChanges) {
            store.setContent({ ...currentContent, children: updatedChildren }, true);
          }
        }
        return;
      }
      // Preserve selection when only pageOverrides change (to keep sidebar visible)
      store.setContent(contentWithGlobalLayout, true);
    }
  }, [pageType, contentWithGlobalLayout, layoutLoading, overridesLoading, store, store.isDirty, globalLayout]);


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
    console.log('[handleAddBlock] Called with:', { type, parentId, index });
    
    // The store.addBlock now uses functional setState internally with structuredClone,
    // ensuring full immutability and new references. It returns { ok, blockId, reason }.
    
    let result: { ok: boolean; blockId?: string; reason?: string };
    
    if (parentId !== undefined && index !== undefined) {
      // Explicit parent and index provided (e.g., from drag-and-drop)
      console.log('[handleAddBlock] Using explicit parent/index:', { parentId, index });
      result = store.addBlock(type, parentId, index);
    } else {
      // Let resolveInsertTarget determine the best location
      console.log('[handleAddBlock] Using default insertion (root)');
      result = store.addBlock(type);
    }
    
    // Provide user feedback based on result
    if (result.ok) {
      toast.success(`Bloco "${blockRegistry.get(type)?.label || type}" adicionado`);
    } else {
      toast.error(`Erro ao adicionar bloco: ${result.reason || 'Falha desconhecida'}`);
      console.error('[handleAddBlock] Failed to add block:', result);
    }
  }, [store]);

  // Determine entity type based on pageType
  // page_template is treated as 'page' entity but saved directly to page_templates table
  const entityType = (pageType === 'institutional' || pageType === 'landing_page' || pageType === 'page_template') ? 'page' : 'template';

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

      // NEW MULTI-TEMPLATE SYSTEM: If templateSetId is present, save to template set
      if (templateSetId && ['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail'].includes(pageType)) {
        await saveTemplateSetDraft.mutateAsync({
          templateSetId,
          pageType: pageType as 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail',
          content: contentToSave,
        });
        store.markClean();
        toast.success('Rascunho salvo!');
        return;
      }

      // LEGACY: Save to old system
      await saveDraft.mutateAsync({
        entityType,
        pageType: (entityType === 'template' || pageType === 'page_template') ? pageType : undefined,
        pageId: entityType === 'page' ? pageId : undefined,
        content: contentToSave,
      });
      store.markClean();
      toast.success('Rascunho salvo!');
    } catch (error) {
      toast.error('Erro ao salvar rascunho');
    }
  }, [saveDraft, saveTemplateSetDraft, entityType, pageType, pageId, store, isHomePage, isCheckoutPage, updateGlobalHeader, updateGlobalFooter, updateCheckoutHeader, updateCheckoutFooter, templateSetId]);

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

      // NEW MULTI-TEMPLATE SYSTEM: If templateSetId is present, save draft and publish
      if (templateSetId && ['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail'].includes(pageType)) {
        // First save the draft
        await saveTemplateSetDraft.mutateAsync({
          templateSetId,
          pageType: pageType as 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail',
          content: contentToSave,
        });
        // Then publish the template set
        await publishTemplateSet.mutateAsync({ templateSetId });
        store.markClean();
        return;
      }

      // LEGACY: Publish to old system
      await publish.mutateAsync({
        entityType,
        pageType: (entityType === 'template' || pageType === 'page_template') ? pageType : undefined,
        pageId: entityType === 'page' ? pageId : undefined,
        content: contentToSave,
      });
      store.markClean();
      toast.success('Página publicada com sucesso!');
    } catch (error) {
      toast.error('Erro ao publicar página');
    }
  }, [publish, publishTemplateSet, saveTemplateSetDraft, entityType, pageType, pageId, store, isHomePage, isCheckoutPage, updateGlobalHeader, updateGlobalFooter, updateCheckoutHeader, updateCheckoutFooter, templateSetId]);

  // Handle deleting selected block
  const handleDeleteBlock = useCallback(() => {
    if (!store.selectedBlockId) return;
    const def = store.selectedBlockDefinition;
    const blockType = store.selectedBlock?.type;
    
    // Check page contract first (lockDelete for required blocks)
    if (blockType && !canDeleteBlock(pageType, blockType)) {
      const info = getRequiredBlockInfo(pageType, blockType);
      toast.error(`Este bloco é obrigatório: ${info?.label || 'Estrutura do sistema'}`);
      return;
    }
    
    // Then check registry-level isRemovable
    if (def?.isRemovable === false) {
      toast.error('Este bloco não pode ser removido');
      return;
    }
    store.removeBlock(store.selectedBlockId);
    toast.success('Bloco removido');
  }, [store, pageType]);

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
    
    // CRITICAL: Never allow deleting the root block
    if (blockId === store.content?.id) {
      toast.error('Não é possível excluir a estrutura principal da página');
      return;
    }
    
    // CRITICAL: NEVER allow deleting Header or Footer
    if (['Header', 'Footer'].includes(block.type)) {
      toast.error('O cabeçalho e rodapé são partes essenciais e não podem ser removidos');
      return;
    }
    
    // CRITICAL: Protect structural container types that could break the page
    const structuralTypes = ['Page', 'Section', 'Layout', 'StorefrontWrapper', 'PageWrapper'];
    if (structuralTypes.includes(block.type)) {
      // Check if this is a direct child of root
      const isDirectChildOfRoot = store.content?.children?.some(c => c.id === blockId);
      if (isDirectChildOfRoot) {
        // Count Sections at root level
        const sectionCount = store.content?.children?.filter(c => c.type === 'Section').length || 0;
        // If this is the last Section, don't delete
        if (block.type === 'Section' && sectionCount <= 1) {
          toast.error('É necessário manter pelo menos uma seção na página');
          return;
        }
        // Check if this container has Header or Footer children
        const hasEssentialChild = block.children?.some(child => 
          ['Header', 'Footer'].includes(child.type)
        );
        if (hasEssentialChild) {
          toast.error('Este container possui blocos essenciais e não pode ser removido');
          return;
        }
      }
    }
    
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
    navigate('/storefront');
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

  // Debug panel query states
  const debugQueries: DebugQueryState[] = [
    {
      name: 'globalLayout',
      isLoading: layoutLoading,
      isError: !globalLayout && !layoutLoading,
      dataPreview: globalLayout ? 'loaded' : 'empty',
    },
    {
      name: 'pageOverrides',
      isLoading: overridesLoading,
      isError: false,
      dataPreview: pageOverrides ? JSON.stringify(pageOverrides).slice(0, 50) : 'empty',
    },
  ];

  // Loading state - MUST be after all hooks to avoid React rules violation
  // Only show loading if actually loading AND data not yet available
  const isActuallyLoading = (layoutLoading && !globalLayout) || (overridesLoading && !pageOverrides);
  
  // ISOLATION MODE: render minimal UI for testing layers
  // ?isolate=visual - test VisualBuilder without DnD/Canvas
  // NOTE: All hooks have been called before this point
  if (isolateMode === 'visual') {
    return <VisualIsolationUI mode="visual" message="VisualBuilder shell (sem DnD/Canvas)" />;
  }

  if (isActuallyLoading) {
    return (
      <>
        <BuilderDebugPanel pageType={pageType} queries={debugQueries} isSafeMode={isSafeMode} />
        <div className="h-screen w-screen flex items-center justify-center bg-background fixed inset-0 z-50">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando editor...</p>
          </div>
        </div>
      </>
    );
  }

  // ISOLATION MODE: canvas - render shell without BlockRenderer
  if (isolateMode === 'canvas') {
    return <VisualIsolationUI mode="canvas" message="Canvas (sem BlockRenderer)" />;
  }

// ISOLATION MODE: blocks - render with single simple block
  if (isolateMode === 'blocks') {
    return <VisualIsolationUI mode="blocks" message="BlockRenderer com bloco simples" />;
  }
  
  // ISOLATION MODE: blocks-real - render real blocks one by one to find the culprit
  // Usage: ?edit=home&isolate=blocks-real&blockIndex=0 (increment blockIndex to test each block)
  const blockIndexParam = searchParams.get('blockIndex');
  if (isolateMode === 'blocks-real') {
    const blockIndex = parseInt(blockIndexParam || '0', 10);
    const realBlocks = store.content?.children || [];
    
    // Get list of block types for debugging
    const blockList = realBlocks.map((b, i) => `${i}: ${b.type}`).join(', ');
    
    if (blockIndex >= realBlocks.length) {
      return (
        <div className="h-screen flex flex-col">
          <div className="bg-green-500/10 border-b border-green-500/30 px-4 py-3">
            <p className="text-sm font-medium text-green-600">
              ✅ Todos os blocos testados ({realBlocks.length} blocos) — Nenhum erro individual detectado
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center bg-muted/50 p-8">
            <div className="text-center space-y-4 max-w-xl">
              <div className="text-6xl">🎉</div>
              <p className="text-muted-foreground">
                Blocos testados: {blockList || 'Nenhum'}
              </p>
              <p className="text-sm text-muted-foreground">
                O erro pode estar na interação entre blocos ou no layout/DnD.
                Teste <code className="bg-muted px-2 py-0.5 rounded">?isolate=full</code>
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    const testBlock = realBlocks[blockIndex];
    
    return (
      <div className="h-screen flex flex-col">
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-3">
          <p className="text-sm font-medium text-orange-600">
            🔬 Testando bloco {blockIndex + 1}/{realBlocks.length}: <code className="bg-orange-500/20 px-2 py-0.5 rounded">{testBlock.type}</code>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Se der erro, este bloco ({testBlock.type}) é o problema. Caso contrário, teste o próximo: 
            <a href={`?edit=home&isolate=blocks-real&blockIndex=${blockIndex + 1}`} className="text-primary underline ml-1">blockIndex={blockIndex + 1}</a>
          </p>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-muted/50">
          <div className="bg-background rounded-lg shadow-sm p-4 max-w-4xl mx-auto">
            <BlockRenderer
              node={testBlock}
              context={builderContext}
              isEditing={true}
              isInteractMode={false}
              isSafeMode={false}
            />
          </div>
        </div>
        <div className="border-t bg-background px-4 py-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {realBlocks.map((b, i) => (
              <a 
                key={i}
                href={`?edit=home&isolate=blocks-real&blockIndex=${i}`}
                className={`px-2 py-1 rounded ${i === blockIndex ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              >
                {i}: {b.type}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <BuilderDebugPanel pageType={pageType} queries={debugQueries} isSafeMode={isSafeMode} />
    <DndContext
      sensors={sensors}
      onDragStart={(event) => {
        const blockType = event.active.data.current?.blockType;
        if (blockType) {
          setDraggingBlockType(blockType);
        }
      }}
      onDragEnd={(event) => {
        setDraggingBlockType(null);
        // Note: Block addition is handled by BuilderCanvas useDndMonitor
        // This handler only clears the dragging state
      }}
      onDragCancel={() => {
        setDraggingBlockType(null);
      }}
    >
    <div className="h-screen w-screen flex flex-col bg-muted/30 overflow-hidden fixed inset-0 z-50">
      {/* Toolbar */}
      <BuilderToolbar
        pageTitle={pageTypeLabels[pageType] || pageType}
        pageType={pageType}
        pageId={pageId}
        tenantSlug={context.tenantSlug}
        pageSlug={pageSlug}
        templateSetId={templateSetId}
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
        {/* Left Sidebar - Unified Structure (Yampi-style) */}
        {!isPreviewMode && (
          <div className="w-56 flex-shrink-0 border-r bg-background flex flex-col shadow-sm">
            {/* Unified Sidebar - No more page-specific settings here */}
            {/* Settings moved to ThemeSettingsPanel > Páginas */}
            <BuilderSidebar
              content={store.content}
              selectedBlockId={store.selectedBlockId}
              pageType={pageType}
              onSelectBlock={store.selectBlock}
              onMoveBlock={handleMoveBlock}
              onToggleHidden={handleToggleHidden}
              onDeleteBlock={handleDeleteBlockById}
              onOpenAddBlock={() => setShowAddBlockDrawer(true)}
              onOpenThemeSettings={() => setShowThemeSettings(true)}
              templateName={pageTypeLabels[pageType] || 'Tema'}
            />
          </div>
        )}

        {/* Add Block Drawer */}
        <AddBlockDrawer
          open={showAddBlockDrawer}
          onOpenChange={setShowAddBlockDrawer}
          onAddBlock={handleAddBlock}
        />

        {/* Theme Settings Panel */}
        <ThemeSettingsPanel
          open={showThemeSettings}
          onOpenChange={setShowThemeSettings}
          tenantId={tenantId}
          templateSetId={templateSetId}
          onNavigateToPage={(newPageType) => {
            // Navigate to edit different page type while preserving theme settings panel state
            const url = new URL(window.location.href);
            url.searchParams.set('edit', newPageType);
            // Preserve settings param to keep theme settings open
            url.searchParams.set('settings', 'theme');
            navigate(url.pathname + url.search);
          }}
          showMiniCartPreview={showMiniCartPreview}
          onToggleMiniCartPreview={setShowMiniCartPreview}
          onMiniCartConfigChange={setMiniCartConfig}
        />
        
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
            isSafeMode={isSafeMode}
            viewport={canvasViewport}
            onViewportChange={setCanvasViewport}
            storeSettings={{
              primary_color: context.settings?.primary_color,
              secondary_color: context.settings?.secondary_color,
              accent_color: context.settings?.accent_color,
            }}
            showMiniCartPreview={showMiniCartPreview}
            onToggleMiniCartPreview={setShowMiniCartPreview}
            miniCartConfig={miniCartConfig}
          />
        </div>

        {/* Right Sidebar - Props Editor */}
        {!isPreviewMode && (
          <div className="w-72 flex-shrink-0 bg-background shadow-sm">
            {store.selectedBlock && store.selectedBlockDefinition ? (
              // Header/Footer: Show message to use Theme Settings instead
              store.selectedBlock.type === 'Header' || store.selectedBlock.type === 'Footer' ? (
                <div className="h-full flex items-center justify-center p-6 border-l">
                  <div className="text-center text-muted-foreground">
                    <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">
                      {store.selectedBlock.type === 'Header' ? 'Cabeçalho' : 'Rodapé'}
                    </p>
                    <p className="text-xs mt-1">
                      Configure em <strong>Configurações do tema</strong> no menu esquerdo
                    </p>
                  </div>
                </div>
              ) : (
                <PropsEditor
                  definition={store.selectedBlockDefinition}
                  props={store.selectedBlock.props}
                  onChange={handlePropsChange}
                  onDelete={handleDeleteBlock}
                  onDuplicate={handleDuplicateBlock}
                  canDelete={
                    store.selectedBlockDefinition.isRemovable !== false && 
                    canDeleteBlock(pageType, store.selectedBlock?.type || '')
                  }
                  pageType={pageType}
                  blockType={store.selectedBlock?.type}
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
    </>
  );
}
