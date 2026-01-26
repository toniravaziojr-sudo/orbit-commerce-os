// =============================================
// BUILDER CANVAS - Preview area with Container Queries for real responsive breakpoints
// Uses CSS container queries so blocks respond to canvas width, not window width
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { BlockRenderer } from './BlockRenderer';
import { BuilderContextProvider } from './BuilderContext';
import { MiniCartPreview } from './MiniCartPreview';
import { MiniCartConfig } from './theme-settings/MiniCartSettings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Monitor, Smartphone, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useDndMonitor, useDroppable, DragEndEvent } from '@dnd-kit/core';

// Viewport dimensions
const VIEWPORT_SIZES = {
  desktop: { width: 1280, label: 'Desktop' },
  mobile: { width: 390, label: 'Mobile' },
} as const;

type ViewportMode = keyof typeof VIEWPORT_SIZES;

// Zoom constants
const ZOOM_MIN = 25;
const ZOOM_MAX = 150;
const ZOOM_STEP = 5;

interface BuilderCanvasProps {
  content: BlockNode;
  context: BlockRenderContext;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onAddBlock?: (type: string, parentId?: string, index?: number) => void;
  onMoveBlock?: (blockId: string, direction: 'up' | 'down') => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onToggleHidden?: (blockId: string) => void;
  onUpdateProps?: (blockId: string, props: Record<string, unknown>) => void;
  isPreviewMode?: boolean;
  isInteractMode?: boolean;
  isSafeMode?: boolean;
  viewport?: 'desktop' | 'mobile';
  onViewportChange?: (viewport: 'desktop' | 'mobile') => void;
  // NOTE: storeSettings.primary_color, secondary_color, accent_color removed
  // Theme colors are now managed via Configuração do tema > Cores
  // Mini-cart preview controls
  showMiniCartPreview?: boolean;
  onToggleMiniCartPreview?: (open: boolean) => void;
  miniCartConfig?: MiniCartConfig;
}

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
  onUpdateProps,
  isPreviewMode = false,
  isInteractMode = false,
  isSafeMode = false,
  viewport: controlledViewport,
  onViewportChange,
  showMiniCartPreview = false,
  onToggleMiniCartPreview,
  miniCartConfig,
}: BuilderCanvasProps) {
  const [internalViewport, setInternalViewport] = useState<ViewportMode>('desktop');
  const [zoom, setZoom] = useState<number>(100);
  
  const viewport: ViewportMode = controlledViewport || internalViewport;
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // NOTE: Theme colors are now managed via Configuração do tema > Cores (useThemeSettings)
  // Legacy primary_color/secondary_color/accent_color from store_settings are no longer used here

  const handleViewportChange = (newViewport: ViewportMode) => {
    setInternalViewport(newViewport);
    onViewportChange?.(newViewport);
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
      
      if (!onAddBlock) return;
      
      const blockType = active.data.current?.blockType;
      const isNewBlock = active.data.current?.isNewBlock;
      
      // Only handle new blocks from the drawer
      if (!blockType || !isNewBlock) return;
      
      // If dropped over a specific target, use that position
      if (over) {
        const overData = over.data.current;
        const parentId = overData?.parentId || content.id;
        const index = overData?.index ?? (content.children?.length || 0);
        onAddBlock(blockType, parentId, index);
      } else {
        // If dropped anywhere (even outside canvas), add at the end
        // This allows dropping from drawer without precise targeting
        onAddBlock(blockType);
      }
      
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
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
    }
  };

  const currentViewportSize = VIEWPORT_SIZES[viewport];

  return (
    <div className="h-full flex flex-col">
      {/* Safe Mode Banner */}
      {isSafeMode && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-3 py-2 text-center">
          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            🛡️ Safe Mode — Blocos simplificados para evitar erro #300. Remove ?safe=1 da URL para voltar ao normal.
          </span>
        </div>
      )}

      {/* Interact Mode Banner */}
      {isInteractMode && !isPreviewMode && !isSafeMode && (
        <div className="bg-primary/10 border-b border-primary/20 px-3 py-1 text-center">
          <span className="text-xs font-medium text-primary">
            🖱️ Modo Testar ativo — ESC ou "Editar" para voltar
          </span>
        </div>
      )}

      {/* Viewport Controls - Clean UI like Yampi */}
      {!isPreviewMode && (
        <div className="flex items-center justify-center gap-4 py-2 px-3 border-b bg-background">
          {/* Viewport Toggle - Simple icons */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => handleViewportChange('desktop')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewport === 'desktop'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewportChange('mobile')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewport === 'mobile'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Mobile"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
              className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
              disabled={zoom <= ZOOM_MIN}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <Slider 
              value={[zoom]} 
              onValueChange={([val]) => setZoom(val)}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              className="w-24"
            />
            <button
              onClick={() => setZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
              className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
              disabled={zoom >= ZOOM_MAX}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setZoom(100)} 
              className={cn(
                "text-xs px-2 py-0.5 rounded transition-colors min-w-[40px]",
                zoom === 100 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {zoom}%
            </button>
          </div>
        </div>
      )}

      {/* Canvas Area - Centered with container queries */}
      {/* AJUSTE: Zoom centralizado - usa display: flex no container pai e width calculada */}
      <ScrollArea className="flex-1 bg-muted/50">
        <div 
          className={cn(
            "min-h-full p-4",
            isOver && "bg-primary/5"
          )}
          onClick={handleCanvasClick}
          style={{
            // Container takes full width and centers content via flexbox
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {/* Zoom wrapper - TRUE CENTER: fixed width wrapper that scales visually but maintains center position */}
          <div
            style={{ 
              // The wrapper has the SCALED width so the flex container centers it correctly
              width: `${currentViewportSize.width * (zoom / 100)}px`,
              // Transform scales the visual but transform-origin keeps it centered
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <div
                ref={setNodeRef}
                className={cn(
                  'storefront-container bg-background transition-all duration-300 relative overflow-hidden',
                  viewport === 'mobile' && 'rounded-2xl shadow-xl border-4 border-muted/50'
                )}
                style={{ 
                  width: `${currentViewportSize.width}px`,
                  minHeight: viewport === 'mobile' ? '700px' : '600px',
                  containerType: 'inline-size',
                  containerName: 'storefront',
                }}
              >
                {/* Mobile notch decoration */}
                {viewport === 'mobile' && (
                  <div className="h-6 bg-muted/20 flex items-center justify-center rounded-t-xl">
                    <div className="w-20 h-1 bg-muted rounded-full" />
                  </div>
                )}

                
                <BuilderContextProvider
                  updateProps={onUpdateProps || (() => {})}
                  isEditing={!isPreviewMode && !isInteractMode}
                  selectedBlockId={selectedBlockId}
                >
                  <BlockRenderer
                    node={content}
                    context={{ ...context, viewport }}
                    isSelected={selectedBlockId === content.id}
                    isEditing={!isPreviewMode && !isInteractMode}
                    isInteractMode={isInteractMode}
                    isSafeMode={isSafeMode}
                    onSelect={isInteractMode ? undefined : onSelectBlock}
                    onAddBlock={isInteractMode ? undefined : onAddBlock}
                    onMoveBlock={isInteractMode ? undefined : onMoveBlock}
                    onDuplicateBlock={isInteractMode ? undefined : onDuplicateBlock}
                    onDeleteBlock={isInteractMode ? undefined : onDeleteBlock}
                    onToggleHidden={isInteractMode ? undefined : onToggleHidden}
                  />
                </BuilderContextProvider>

                {/* Mini-cart preview overlay - rendered inside the canvas for realistic preview */}
                <MiniCartPreview
                  open={showMiniCartPreview}
                  onOpenChange={onToggleMiniCartPreview || (() => {})}
                  viewport={viewport}
                  config={miniCartConfig}
                />
              </div>
            </div>
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
          <span className="opacity-50">{currentViewportSize.width}px</span>
        </div>
      )}
    </div>
  );
}
