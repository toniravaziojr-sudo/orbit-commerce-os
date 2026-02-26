import { EmailBlock } from "@/lib/email-builder-utils";
import { cn } from "@/lib/utils";
import { Trash2, Copy, GripVertical, Type, Image, MousePointerClick, Minus, Space, Columns2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  text: Type, image: Image, button: MousePointerClick, divider: Minus,
  spacer: Space, columns: Columns2, product: ShoppingBag,
};

interface EmailCanvasProps {
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onRemoveBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (from: number, to: number) => void;
}

function BlockPreview({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case 'text': {
      const Tag = (block.props.tag || 'p') as keyof JSX.IntrinsicElements;
      const fontSize = block.props.tag === 'h1' ? '24px' : block.props.tag === 'h2' ? '20px' : '16px';
      return (
        <div style={{ textAlign: block.props.align || 'left', color: block.props.color || '#333', fontSize }}>
          {block.props.content || 'Texto vazio...'}
        </div>
      );
    }
    case 'image':
      return block.props.src ? (
        <img src={block.props.src} alt={block.props.alt} className="max-w-full h-auto rounded" style={{ width: block.props.width || '100%' }} />
      ) : (
        <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
          <Image className="h-8 w-8 mr-2 opacity-50" /> Adicione uma URL de imagem
        </div>
      );
    case 'button':
      return (
        <div style={{ textAlign: block.props.align || 'center', padding: '8px 0' }}>
          <span
            className="inline-block px-6 py-3 font-semibold text-sm"
            style={{
              backgroundColor: block.props.bgColor || '#3b82f6',
              color: block.props.textColor || '#fff',
              borderRadius: `${block.props.borderRadius || 6}px`,
              width: block.props.fullWidth ? '100%' : 'auto',
            }}
          >
            {block.props.text || 'Botão'}
          </span>
        </div>
      );
    case 'divider':
      return <hr style={{ borderColor: block.props.color || '#e5e7eb', borderWidth: `${block.props.thickness || 1}px`, borderStyle: block.props.style || 'solid' }} />;
    case 'spacer':
      return <div style={{ height: `${block.props.height || 24}px` }} className="bg-muted/30 rounded border border-dashed border-muted-foreground/20" />;
    case 'columns':
      return (
        <div className="flex gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-16 bg-muted/50 rounded flex items-center justify-center border border-dashed">Coluna 1</div>
          <div className="flex-1 h-16 bg-muted/50 rounded flex items-center justify-center border border-dashed">Coluna 2</div>
        </div>
      );
    case 'product':
      return (
        <div className="border rounded-lg p-4 text-center">
          {block.props.showImage && <div className="h-24 bg-muted rounded mb-3 flex items-center justify-center text-muted-foreground text-xs">Imagem do Produto</div>}
          <p className="font-semibold text-sm">Nome do Produto</p>
          {block.props.showPrice && <p className="text-primary font-bold mt-1">R$ 99,90</p>}
          {block.props.showButton && (
            <span className="inline-block mt-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs rounded font-medium">
              {block.props.buttonText || 'Comprar'}
            </span>
          )}
        </div>
      );
    default:
      return null;
  }
}

export function EmailCanvas({ blocks, selectedBlockId, onSelectBlock, onRemoveBlock, onDuplicateBlock, onMoveBlock }: EmailCanvasProps) {
  if (blocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Type className="h-8 w-8 opacity-50" />
          </div>
          <p className="font-medium">Seu email está vazio</p>
          <p className="text-sm mt-1">Clique nos blocos à esquerda para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-muted/20" onClick={() => onSelectBlock(null)}>
      <div className="max-w-[620px] mx-auto bg-background rounded-lg shadow-sm border">
        <div className="p-1">
          {blocks.map((block, index) => {
            const isSelected = block.id === selectedBlockId;
            return (
              <div
                key={block.id}
                onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
                className={cn(
                  "relative group rounded-md transition-all cursor-pointer",
                  isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/30"
                )}
              >
                {/* Toolbar */}
                <div className={cn(
                  "absolute -top-3 right-2 z-10 flex items-center gap-1 bg-background border rounded-md shadow-sm px-1",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  "transition-opacity"
                )}>
                  {index > 0 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); onMoveBlock(index, index - 1); }}>
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); onDuplicateBlock(block.id); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); onRemoveBlock(block.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="p-4">
                  <BlockPreview block={block} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
