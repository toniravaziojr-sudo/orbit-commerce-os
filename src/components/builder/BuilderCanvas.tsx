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
  onAddBlock?: (type: string) => void;
  isPreviewMode?: boolean;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const viewportSizes: Record<ViewportSize, { width: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: '100%', label: 'Desktop', icon: Monitor },
  tablet: { width: '768px', label: 'Tablet', icon: Tablet },
  mobile: { width: '375px', label: 'Mobile', icon: Smartphone },
};

export function BuilderCanvas({
  content,
  context,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
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
    <div className="h-full flex flex-col">
      {/* Viewport Controls */}
      {!isPreviewMode && (
        <div className="flex items-center justify-center gap-1 py-2 px-4 bg-background border-b">
          {(Object.entries(viewportSizes) as [ViewportSize, typeof viewportSizes.desktop][]).map(
            ([size, { icon: Icon, label }]) => (
              <button
                key={size}
                onClick={() => setViewport(size)}
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
          className="min-h-full p-4 sm:p-6 flex justify-center"
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
          <span className="truncate">
            {selectedBlockId ? (
              <>Bloco selecionado: <code className="bg-muted px-1 py-0.5 rounded">{selectedBlockId}</code></>
            ) : (
              'Clique em um bloco para editar'
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
