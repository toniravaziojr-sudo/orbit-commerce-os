// =============================================
// VISUAL BUILDER - Main builder component
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuilderStore } from '@/hooks/useBuilderStore';
import { useBuilderData } from '@/hooks/useBuilderData';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { BuilderToolbar } from './BuilderToolbar';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockPalette } from './BlockPalette';
import { PropsEditor } from './PropsEditor';
import { findParentBlock } from '@/lib/builder/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VisualBuilderProps {
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout';
  pageId?: string;
  initialContent?: BlockNode;
  context: BlockRenderContext;
}

export function VisualBuilder({
  tenantId,
  pageType,
  pageId,
  initialContent,
  context,
}: VisualBuilderProps) {
  const navigate = useNavigate();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  // Get initial content from prop or default template
  const startingContent = initialContent || getDefaultTemplate(pageType);

  // Builder store for state management
  const store = useBuilderStore(startingContent);

  // Data mutations
  const { saveDraft, publish } = useBuilderData(tenantId);

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

  // Handle adding a new block
  const handleAddBlock = useCallback((type: string) => {
    const parentId = store.selectedBlockId || 'root';
    store.addBlock(type, parentId);
    toast.success(`Bloco ${blockRegistry[type]?.label || type} adicionado`);
  }, [store]);

  // Handle saving draft
  const handleSave = useCallback(async () => {
    try {
      await saveDraft.mutateAsync({
        entityType: 'template',
        pageType,
        pageId,
        content: store.content,
      });
      store.markClean();
      toast.success('Rascunho salvo!');
    } catch (error) {
      toast.error('Erro ao salvar rascunho');
    }
  }, [saveDraft, pageType, pageId, store]);

  // Handle publishing
  const handlePublish = useCallback(async () => {
    try {
      await publish.mutateAsync({
        entityType: 'template',
        pageType,
        pageId,
        content: store.content,
      });
      store.markClean();
      toast.success('Página publicada!');
    } catch (error) {
      toast.error('Erro ao publicar página');
    }
  }, [publish, pageType, pageId, store]);

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
    const defaultContent = getDefaultTemplate(pageType);
    store.setContent(defaultContent);
    toast.success('Conteúdo resetado para o padrão');
  }, [pageType, store]);

  // Go back
  const handleBack = useCallback(() => {
    if (store.isDirty) {
      if (!confirm('Você tem alterações não salvas. Deseja sair?')) {
        return;
      }
    }
    navigate('/admin/storefront');
  }, [navigate, store.isDirty]);

  const pageTypeLabels: Record<string, string> = {
    home: 'Página Inicial',
    category: 'Página de Categoria',
    product: 'Página de Produto',
    cart: 'Carrinho',
    checkout: 'Checkout',
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <BuilderToolbar
        pageTitle={pageTypeLabels[pageType] || pageType}
        pageType={pageType}
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
        onBack={handleBack}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Block Palette */}
        {!isPreviewMode && showPalette && (
          <div className="w-56 flex-shrink-0">
            <BlockPalette onAddBlock={handleAddBlock} />
          </div>
        )}

        {/* Center - Canvas */}
        <div className="flex-1 overflow-hidden">
          <BuilderCanvas
            content={store.content}
            context={context}
            selectedBlockId={store.selectedBlockId}
            onSelectBlock={store.selectBlock}
            isPreviewMode={isPreviewMode}
          />
        </div>

        {/* Right Sidebar - Props Editor */}
        {!isPreviewMode && showInspector && store.selectedBlock && store.selectedBlockDefinition && (
          <div className="w-72 flex-shrink-0">
            <PropsEditor
              definition={store.selectedBlockDefinition}
              props={store.selectedBlock.props}
              onChange={handlePropsChange}
              onDelete={handleDeleteBlock}
              onDuplicate={handleDuplicateBlock}
              canDelete={store.selectedBlockDefinition.isRemovable !== false}
            />
          </div>
        )}

        {/* Empty state when no block selected */}
        {!isPreviewMode && showInspector && !store.selectedBlock && (
          <div className="w-72 flex-shrink-0 bg-card border-l flex items-center justify-center p-6">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Selecione um bloco para editar suas propriedades</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
