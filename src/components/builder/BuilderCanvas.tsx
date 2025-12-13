// =============================================
// BUILDER CANVAS - Preview area for blocks
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { BlockRenderer } from './BlockRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { useState } from 'react';

interface BuilderCanvasProps {
  content: BlockNode;
  context: BlockRenderContext;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  isPreviewMode?: boolean;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const viewportSizes: Record<ViewportSize, { width: string; icon: typeof Monitor }> = {
  desktop: { width: '100%', icon: Monitor },
  tablet: { width: '768px', icon: Tablet },
  mobile: { width: '375px', icon: Smartphone },
};

export function BuilderCanvas({
  content,
  context,
  selectedBlockId,
  onSelectBlock,
  isPreviewMode = false,
}: BuilderCanvasProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Deselect if clicking on canvas background
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Viewport Controls */}
      {!isPreviewMode && (
        <div className="flex items-center justify-center gap-1 p-2 bg-background border-b">
          {(Object.entries(viewportSizes) as [ViewportSize, typeof viewportSizes.desktop][]).map(
            ([size, { icon: Icon }]) => (
              <button
                key={size}
                onClick={() => setViewport(size)}
                className={cn(
                  'p-2 rounded transition-colors',
                  viewport === size
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                title={size.charAt(0).toUpperCase() + size.slice(1)}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      )}

      {/* Canvas Area */}
      <ScrollArea className="flex-1">
        <div 
          className="min-h-full p-4 flex justify-center"
          onClick={handleCanvasClick}
        >
          <div
            className={cn(
              'bg-background shadow-lg transition-all duration-300',
              viewport !== 'desktop' && 'rounded-lg overflow-hidden'
            )}
            style={{ 
              width: viewportSizes[viewport].width,
              minHeight: 'calc(100vh - 120px)',
            }}
          >
            <BlockRenderer
              node={content}
              context={context}
              isSelected={selectedBlockId === content.id}
              isEditing={!isPreviewMode}
              onSelect={onSelectBlock}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Status Bar */}
      {!isPreviewMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-background border-t text-xs text-muted-foreground">
          <span>
            {selectedBlockId ? `Selecionado: ${selectedBlockId}` : 'Clique em um bloco para editar'}
          </span>
          <span>Viewport: {viewport}</span>
        </div>
      )}
    </div>
  );
}
