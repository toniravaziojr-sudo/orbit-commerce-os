// =============================================
// BUILDER CANVAS - Preview area for blocks with DnD support
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { BlockRenderer } from './BlockRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Monitor, Smartphone } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
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

// Desktop viewport width and mobile width
const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 375;

const viewportSizes: Record<ViewportSize, { width: number; label: string; icon: typeof Monitor }> = {
  desktop: { width: DESKTOP_WIDTH, label: 'Desktop', icon: Monitor },
  mobile: { width: MOBILE_WIDTH, label: 'Mobile', icon: Smartphone },
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
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleViewportChange = (newViewport: ViewportSize) => {
    if (onViewportChange) {
      onViewportChange(newViewport);
    } else {
      setInternalViewport(newViewport);
    }
  };

  // Calculate scale based on available container width
  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current || isPreviewMode) {
        setScale(1);
        return;
      }

      const containerWidth = containerRef.current.offsetWidth;
      const targetWidth = viewportSizes[viewport].width;
      const padding = 24; // 12px padding on each side
      const availableWidth = containerWidth - padding;

      if (availableWidth < targetWidth) {
        // Scale down to fit
        const newScale = availableWidth / targetWidth;
        setScale(Math.max(0.5, Math.min(1, newScale))); // Clamp between 0.5 and 1
      } else {
        setScale(1);
      }
    };

    calculateScale();

    const resizeObserver = new ResizeObserver(calculateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [viewport, isPreviewMode]);

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

  const targetWidth = viewportSizes[viewport].width;

  return (
    <div className="h-full flex flex-col">
      {/* Interact Mode Banner */}
      {isInteractMode && !isPreviewMode && (
        <div className="bg-primary/10 border-b border-primary/20 px-3 py-1 text-center">
          <span className="text-xs font-medium text-primary">
            🖱️ Modo Testar ativo — ESC ou "Editar" para voltar
          </span>
        </div>
      )}

      {/* Viewport Controls */}
      {!isPreviewMode && (
        <div className="flex items-center justify-center gap-1 py-1.5 px-3 bg-background border-b">
          {(Object.entries(viewportSizes) as [ViewportSize, typeof viewportSizes.desktop][]).map(
            ([size, { icon: Icon, label }]) => (
              <button
                key={size}
                onClick={() => handleViewportChange(size)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
                  viewport === size
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                )}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            )
          )}
          {scale < 1 && (
            <span className="ml-2 text-[10px] text-muted-foreground">
              {Math.round(scale * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <ScrollArea className="flex-1 bg-muted/50">
        <div 
          ref={containerRef}
          className={cn(
            "min-h-full p-3 flex justify-center",
            isOver && "bg-primary/5"
          )}
          onClick={handleCanvasClick}
        >
          <div
            ref={setNodeRef}
            className={cn(
              'bg-background transition-all duration-300 origin-top',
              viewport !== 'desktop' && 'rounded-lg shadow-xl border',
              viewport === 'desktop' && 'shadow-sm'
            )}
            style={{ 
              width: `${targetWidth}px`,
              minHeight: 'calc(100vh - 180px)',
              transform: scale < 1 ? `scale(${scale})` : undefined,
              transformOrigin: 'top center',
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
        <div className="flex items-center justify-between px-3 py-1 bg-background border-t text-[10px] text-muted-foreground">
          <span className="truncate">
            {isInteractMode ? (
              <span className="text-primary font-medium">Modo Testar — interaja com os elementos</span>
            ) : selectedBlockId ? (
              <>Bloco: <code className="bg-muted px-1 py-0.5 rounded">{selectedBlockId.slice(0, 8)}</code></>
            ) : (
              'Arraste blocos ou clique para editar'
            )}
          </span>
          <span className="opacity-50">{viewport} {scale < 1 ? `(${Math.round(scale * 100)}%)` : ''}</span>
        </div>
      )}
    </div>
  );
}
