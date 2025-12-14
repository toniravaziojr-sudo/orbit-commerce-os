// =============================================
// VISUAL BUILDER - Main builder component
// =============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuilderStore } from '@/hooks/useBuilderStore';
import { useBuilderData } from '@/hooks/useBuilderData';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { BuilderToolbar } from './BuilderToolbar';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockPalette } from './BlockPalette';
import { BlockTree } from './BlockTree';
import { PropsEditor } from './PropsEditor';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, LayoutGrid } from 'lucide-react';

interface VisualBuilderProps {
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'institutional' | 'landing_page';
  pageId?: string;
  pageTitle?: string;
  initialContent?: BlockNode;
  context: BlockRenderContext;
}

export function VisualBuilder({
  tenantId,
  pageType,
  pageId,
  pageTitle,
  initialContent,
  context,
}: VisualBuilderProps) {
  const navigate = useNavigate();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [leftTab, setLeftTab] = useState<'blocks' | 'tree'>('blocks');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Example selectors state (for Product/Category templates)
  const [exampleProductId, setExampleProductId] = useState<string>('');
  const [exampleCategoryId, setExampleCategoryId] = useState<string>('');

  // Get initial content from prop or default template
  const startingContent = useMemo(() => 
    initialContent || getDefaultTemplate(pageType),
    [initialContent, pageType]
  );

  // Builder store for state management
  const store = useBuilderStore(startingContent);

  // Sync content when template changes (e.g. navigating between page types)
  useEffect(() => {
    store.setContent(startingContent);
  }, [pageType, startingContent]);

  // Data mutations
  const { saveDraft, publish } = useBuilderData(tenantId);

  // Build context with example data
  const builderContext = useMemo<BlockRenderContext>(() => ({
    ...context,
    // Override with example IDs when editing Product/Category templates
    ...(pageType === 'product' && exampleProductId ? { productId: exampleProductId, productSlug: exampleProductId } : {}),
    ...(pageType === 'category' && exampleCategoryId ? { categoryId: exampleCategoryId, categorySlug: exampleCategoryId } : {}),
  }), [context, pageType, exampleProductId, exampleCategoryId]);

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
    const targetParentId = parentId || store.selectedBlockId || 'root';
    store.addBlock(type, targetParentId, index);
    toast.success(`Bloco "${blockRegistry.get(type)?.label || type}" adicionado`);
  }, [store]);

  // Determine entity type based on pageType
  const entityType = (pageType === 'institutional' || pageType === 'landing_page') ? 'page' : 'template';

  // Check if this is checkout page (uses separate header/footer)
  const isCheckoutPage = pageType === 'checkout';

  // Handle saving draft
  const handleSave = useCallback(async () => {
    try {
      await saveDraft.mutateAsync({
        entityType,
        pageType: entityType === 'template' ? pageType : undefined,
        pageId: entityType === 'page' ? pageId : undefined,
        content: store.content,
      });
      store.markClean();
      toast.success('Rascunho salvo!');
    } catch (error) {
      toast.error('Erro ao salvar rascunho');
    }
  }, [saveDraft, entityType, pageType, pageId, store]);

  // Handle publishing
  const handlePublish = useCallback(async () => {
    try {
      await publish.mutateAsync({
        entityType,
        pageType: entityType === 'template' ? pageType : undefined,
        pageId: entityType === 'page' ? pageId : undefined,
        content: store.content,
      });
      store.markClean();
      toast.success('Página publicada com sucesso!');
    } catch (error) {
      toast.error('Erro ao publicar página');
    }
  }, [publish, entityType, pageType, pageId, store]);

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

  // Handle reset to default
  const handleReset = useCallback(() => {
    if (!confirm('Isso irá resetar todo o conteúdo para o template padrão. Continuar?')) {
      return;
    }
    const defaultContent = getDefaultTemplate(pageType);
    store.setContent(defaultContent);
    toast.success('Conteúdo resetado para o padrão');
  }, [pageType, store]);

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
    
    const def = blockRegistry.get(block.type);
    if (def?.isRemovable === false) {
      toast.error('Este bloco não pode ser removido');
      return;
    }
    store.removeBlock(blockId);
    toast.success('Bloco removido');
  }, [store]);

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

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Toolbar */}
      <BuilderToolbar
        pageTitle={pageTypeLabels[pageType] || pageType}
        pageType={pageType}
        tenantSlug={context.tenantSlug}
        isDirty={store.isDirty}
        isPreviewMode={isPreviewMode}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        isSaving={saveDraft.isPending}
        isPublishing={publish.isPending}
        onUndo={store.undo}
        onRedo={store.redo}
        onSave={handleSave}
        onPublish={handlePublish}
        onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
        onReset={handleReset}
        onViewHistory={() => setShowVersionHistory(true)}
        onBack={handleBack}
        exampleProductId={exampleProductId}
        exampleCategoryId={exampleCategoryId}
        onExampleProductChange={setExampleProductId}
        onExampleCategoryChange={setExampleCategoryId}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Block Palette + Tree */}
        {!isPreviewMode && (
          <div className="w-64 flex-shrink-0 border-r bg-background flex flex-col shadow-sm">
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
          />
        </div>

        {/* Right Sidebar - Props Editor */}
        {!isPreviewMode && (
          <div className="w-80 flex-shrink-0 bg-background shadow-sm">
            {store.selectedBlock && store.selectedBlockDefinition ? (
              <PropsEditor
                definition={store.selectedBlockDefinition}
                props={store.selectedBlock.props}
                onChange={handlePropsChange}
                onDelete={handleDeleteBlock}
                onDuplicate={handleDuplicateBlock}
                canDelete={store.selectedBlockDefinition.isRemovable !== false}
              />
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
    </div>
  );
}
