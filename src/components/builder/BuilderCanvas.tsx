// =============================================
// BUILDER CANVAS - Preview area with IFRAME for real responsive breakpoints
// Uses iframe to ensure Tailwind breakpoints respond to simulated viewport
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { BlockRenderer } from './BlockRenderer';
import { BuilderViewportFrame, VIEWPORT_SIZES, ViewportMode } from './BuilderViewportFrame';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Monitor, Smartphone, Tablet, ZoomIn, ZoomOut, LayoutTemplate } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useDndMonitor, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { hexToHsl } from '@/contexts/ThemeContext';

// Zoom constants
const ZOOM_MIN = 25;
const ZOOM_MAX = 150;
const ZOOM_STEP = 5;

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
  isSafeMode?: boolean;
  viewport?: 'desktop' | 'mobile';
  onViewportChange?: (viewport: 'desktop' | 'mobile') => void;
  /** Store settings for theme colors */
  storeSettings?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
  } | null;
}

// Extended viewport options for the new iframe system
type ExtendedViewport = ViewportMode;

const viewportConfig: Record<ExtendedViewport, { icon: typeof Monitor; label: string }> = {
  desktop: { icon: Monitor, label: 'Desktop' },
  tablet: { icon: Tablet, label: 'Tablet' },
  mobile: { icon: Smartphone, label: 'Mobile' },
};

// Legacy mode toggle - set to false to use new iframe system
const USE_LEGACY_MODE = false;

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
  isSafeMode = false,
  viewport: controlledViewport,
  onViewportChange,
  storeSettings,
}: BuilderCanvasProps) {
  const [internalViewport, setInternalViewport] = useState<ExtendedViewport>('desktop');
  const [zoom, setZoom] = useState<number>(100);
  const [useLegacy, setUseLegacy] = useState(USE_LEGACY_MODE);
  
  // Map controlled viewport to extended viewport
  const viewport: ExtendedViewport = controlledViewport === 'mobile' ? 'mobile' : 
    (internalViewport === 'tablet' ? 'tablet' : controlledViewport || 'desktop');
  
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Generate CSS variables for theme colors (used in legacy mode)
  const themeStyles = useMemo(() => {
    const vars: Record<string, string> = {};
    
    if (storeSettings?.primary_color) {
      vars['--theme-primary'] = storeSettings.primary_color;
      const hsl = hexToHsl(storeSettings.primary_color);
      if (hsl && !hsl.startsWith('#')) {
        vars['--primary'] = hsl;
      }
    }
    if (storeSettings?.secondary_color) {
      vars['--theme-secondary'] = storeSettings.secondary_color;
      const hsl = hexToHsl(storeSettings.secondary_color);
      if (hsl && !hsl.startsWith('#')) {
        vars['--secondary'] = hsl;
      }
    }
    if (storeSettings?.accent_color) {
      vars['--theme-accent'] = storeSettings.accent_color;
      const hsl = hexToHsl(storeSettings.accent_color);
      if (hsl && !hsl.startsWith('#')) {
        vars['--accent'] = hsl;
      }
    }
    
    return vars as React.CSSProperties;
  }, [storeSettings]);

  const handleViewportChange = (newViewport: ExtendedViewport) => {
    setInternalViewport(newViewport);
    // Also update parent if needed (map tablet to desktop for parent)
    if (onViewportChange) {
      onViewportChange(newViewport === 'mobile' ? 'mobile' : 'desktop');
    }
  };

  // Droppable for the canvas (legacy mode only)
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
      
      const blockType = active.data.current?.blockType;
      if (!blockType) return;
      
      const overData = over.data.current;
      const parentId = overData?.parentId || content.id;
      const index = overData?.index ?? (content.children?.length || 0);
      
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
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
    }
  };

  // Get current viewport info
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

      {/* Viewport Controls */}
      {!isPreviewMode && (
        <div className="flex flex-col border-b bg-background">
          {/* Viewport Controls */}
          <div className="flex items-center justify-center gap-1 py-1.5 px-3">
            {(Object.entries(viewportConfig) as [ExtendedViewport, typeof viewportConfig.desktop][]).map(
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
                  title={`${label} (${VIEWPORT_SIZES[size].width}px)`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )
            )}
            
            {/* Separator */}
            <div className="w-px h-4 bg-border mx-2" />
            
            {/* Mode toggle */}
            <button
              onClick={() => setUseLegacy(!useLegacy)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
                useLegacy 
                  ? 'bg-amber-500/20 text-amber-600' 
                  : 'bg-emerald-500/20 text-emerald-600'
              )}
              title={useLegacy ? 'Modo legado (sem responsividade real)' : 'Modo iframe (responsividade real)'}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{useLegacy ? 'Legado' : 'Real'}</span>
            </button>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center justify-center gap-2 py-1.5 px-3 border-t border-border/50">
            <button
              onClick={() => setZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Diminuir zoom"
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
              className="w-28"
            />
            <button
              onClick={() => setZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Aumentar zoom"
              disabled={zoom >= ZOOM_MAX}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center font-mono">{zoom}%</span>
            <button 
              onClick={() => setZoom(100)} 
              className={cn(
                "text-xs px-2 py-0.5 rounded transition-colors",
                zoom === 100 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted text-muted-foreground"
              )}
              title="Resetar zoom para 100%"
            >
              100%
            </button>
          </div>
          
          {/* Viewport info */}
          <div className="text-center py-1 border-t border-border/30 bg-muted/30">
            <span className="text-[10px] text-muted-foreground">
              {currentViewportSize.width} × {currentViewportSize.height}px
              {!useLegacy && <span className="ml-2 text-emerald-600">• Breakpoints reais</span>}
            </span>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <ScrollArea className="flex-1 bg-muted/50">
        {useLegacy ? (
          // Legacy mode: direct rendering (breakpoints don't respond correctly)
          <div 
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
                width: `${currentViewportSize.width}px`,
                minHeight: 'calc(100vh - 220px)',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                ...themeStyles,
              }}
            >
              <BlockRenderer
                node={content}
                context={{ ...context, viewport: viewport === 'mobile' ? 'mobile' : 'desktop' }}
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
            </div>
          </div>
        ) : (
          // New iframe mode: real breakpoints
          <BuilderViewportFrame
            content={content}
            context={context}
            viewport={viewport}
            zoom={zoom}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            onAddBlock={onAddBlock}
            onMoveBlock={onMoveBlock}
            onDuplicateBlock={onDuplicateBlock}
            onDeleteBlock={onDeleteBlock}
            onToggleHidden={onToggleHidden}
            isPreviewMode={isPreviewMode}
            isInteractMode={isInteractMode}
            isSafeMode={isSafeMode}
            storeSettings={storeSettings}
          />
        )}
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
          <span className="flex items-center gap-2">
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-medium",
              useLegacy ? "bg-amber-500/20 text-amber-600" : "bg-emerald-500/20 text-emerald-600"
            )}>
              {useLegacy ? 'Legacy' : 'Iframe'}
            </span>
            <span className="opacity-50">{viewport} • {currentViewportSize.width}px</span>
          </span>
        </div>
      )}
    </div>
  );
}
