// =============================================
// BUILDER CANVAS - Preview area for blocks with DnD support
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { BlockRenderer } from './BlockRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Monitor, Smartphone } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useDndMonitor, useDroppable, DragEndEvent } from '@dnd-kit/core';

interface BuilderCanvasProps {
  content: BlockNode;
  context: BlockRenderContext;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onAddBlock?: (type: string, parentId: string, index: number) => void;
  onMoveBlock?: (blockId: string, direction: 'up' | 'down') => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onToggleHidden?: (blockId: string) => void;
  isPreviewMode?: boolean;
  isInteractMode?: boolean;
  viewport?: ViewportSize;
  onViewportChange?: (viewport: ViewportSize) => void;
}

type ViewportSize = 'desktop' | 'mobile';

const viewportSizes: Record<ViewportSize, { width: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: '1280px', label: 'Desktop', icon: Monitor },
  mobile: { width: '375px', label: 'Mobile', icon: Smartphone },
};

export function BuilderCanvas({ 
  content, 
  context, 
  selectedBlockId, 
  onSelectBlock, 
  onAddBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onToggleHidden,
  isPreviewMode = false,
  isInteractMode = false,
  viewport: controlledViewport,
  onViewportChange,
}: BuilderCanvasProps) {
  const [internalViewport, setInternalViewport] = useState<ViewportSize>('desktop');
  const viewport = controlledViewport ?? internalViewport;
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleViewportChange = (newViewport: ViewportSize) => {
    if (onViewportChange) {
      onViewportChange(newViewport);
    } else {
      setInternalViewport(newViewport);
    }
  };

  // Droppable for the canvas
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-area',
    data: {
      type: 'canvas',
      parentId: content.id,
    },
  });

  // Handle drag end from palette
  useDndMonitor({
    onDragEnd: useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      
      if (!over || !onAddBlock) return;
      
      // Check if dragging from palette
      const blockType = active.data.current?.blockType;
      if (!blockType) return;
      
      // Determine drop target
      const overData = over.data.current;
      const parentId = overData?.parentId || content.id;
      const index = overData?.index ?? (content.children?.length || 0);
      
      // Add block via same action as "+" button
      onAddBlock(blockType, parentId, index);
      setDropIndex(null);
    }, [onAddBlock, content]),
    onDragOver: useCallback((event: any) => {
      const { over } = event;
      if (over?.data.current?.index !== undefined) {
        setDropIndex(over.data.current.index);
      } else {
        setDropIndex(null);
      }
    }, []),
    onDragCancel: useCallback(() => {
      setDropIndex(null);
    }, []),
  });

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Deselect if clicking on canvas background
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Interact Mode Banner */}
      {isInteractMode && !isPreviewMode && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center">
          <span className="text-sm font-medium text-primary">
            🖱️ Modo Testar ativo — clique nos botões para testar. Pressione ESC ou clique em "Editar" para voltar.
          </span>
        </div>
      )}

      {/* Viewport Controls */}
      {!isPreviewMode && (
        <div className="flex items-center justify-center gap-1 py-2 px-4 bg-background border-b">
          {(Object.entries(viewportSizes) as [ViewportSize, typeof viewportSizes.desktop][]).map(
            ([size, { icon: Icon, label }]) => (
              <button
                key={size}
                onClick={() => handleViewportChange(size)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  viewport === size
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                )}
                title={label}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">{label}</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Canvas Area */}
      <ScrollArea className="flex-1 bg-muted/50">
        <div 
          ref={setNodeRef}
          className={cn(
            "min-h-full p-4 sm:p-6 flex justify-center",
            isOver && "bg-primary/5"
          )}
          onClick={handleCanvasClick}
        >
          <div
            className={cn(
              'bg-background transition-all duration-300',
              viewport !== 'desktop' && 'rounded-lg shadow-xl border',
              viewport === 'desktop' && 'shadow-sm'
            )}
            style={{ 
              width: viewportSizes[viewport].width,
              maxWidth: '100%',
              minHeight: 'calc(100vh - 180px)',
            }}
          >
            <BlockRenderer
              node={content}
              context={{ ...context, viewport }}
              isSelected={selectedBlockId === content.id}
              isEditing={!isPreviewMode && !isInteractMode}
              isInteractMode={isInteractMode}
              onSelect={isInteractMode ? undefined : onSelectBlock}
              onAddBlock={isInteractMode ? undefined : onAddBlock}
              onMoveBlock={isInteractMode ? undefined : onMoveBlock}
              onDuplicateBlock={isInteractMode ? undefined : onDuplicateBlock}
              onDeleteBlock={isInteractMode ? undefined : onDeleteBlock}
              onToggleHidden={isInteractMode ? undefined : onToggleHidden}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Status Bar */}
      {!isPreviewMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t text-xs text-muted-foreground">
          <span className="truncate">
            {isInteractMode ? (
              <span className="text-primary font-medium">Modo Testar — interaja com os elementos</span>
            ) : selectedBlockId ? (
              <>Bloco selecionado: <code className="bg-muted px-1 py-0.5 rounded">{selectedBlockId}</code></>
            ) : (
              'Arraste blocos do menu ou clique para editar'
            )}
          </span>
          <span className="flex items-center gap-1">
            {viewportSizes[viewport].icon && (
              <span className="opacity-50">{viewport}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
