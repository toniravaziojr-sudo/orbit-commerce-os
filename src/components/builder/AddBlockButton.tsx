// =============================================
// ADD BLOCK BUTTON - Button to add blocks between sections
// =============================================

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { blockRegistry } from '@/lib/builder/registry';
import { cn } from '@/lib/utils';

interface AddBlockButtonProps {
  parentId: string;
  index: number;
  onAddBlock: (type: string, parentId: string, index: number) => void;
  allowedBlockTypes?: string[];
  className?: string;
}

export function AddBlockButton({
  parentId,
  index,
  onAddBlock,
  allowedBlockTypes,
  className,
}: AddBlockButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Get all available blocks from registry
  const allBlocks = blockRegistry.getAll();
  
  // Filter blocks based on allowed types and search
  const filteredBlocks = allBlocks.filter((block) => {
    // Skip non-insertable blocks
    if (block.type === 'Page' || block.type === 'Header' || block.type === 'Footer') {
      return false;
    }
    
    // Filter by allowed types if specified
    if (allowedBlockTypes && !allowedBlockTypes.includes(block.type)) {
      return false;
    }
    
    // Filter by search
    if (search && !block.label.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // Group blocks by category
  const groupedBlocks = filteredBlocks.reduce((acc, block) => {
    const category = block.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(block);
    return acc;
  }, {} as Record<string, typeof filteredBlocks>);

  const categoryLabels: Record<string, string> = {
    layout: 'Layout',
    content: 'Conteúdo',
    ecommerce: 'E-commerce',
    'header-footer': 'Cabeçalho/Rodapé',
    outros: 'Outros',
  };

  const handleAddBlock = (type: string) => {
    onAddBlock(type, parentId, index);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 w-full opacity-0 hover:opacity-100 transition-opacity',
            'border border-dashed border-primary/30 hover:border-primary',
            'bg-primary/5 hover:bg-primary/10',
            'text-primary/60 hover:text-primary',
            'group-hover:opacity-60',
            className
          )}
        >
          <Plus className="h-3 w-3 mr-1" />
          <span className="text-xs">Adicionar bloco</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="center" side="bottom">
        <div className="p-2 border-b">
          <Input
            placeholder="Buscar bloco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[280px]">
          <div className="p-2 space-y-3">
            {Object.entries(groupedBlocks).map(([category, blocks]) => (
              <div key={category}>
                <div className="text-xs font-medium text-muted-foreground mb-1 px-1">
                  {categoryLabels[category] || category}
                </div>
                <div className="space-y-0.5">
                  {blocks.map((block) => (
                    <button
                      key={block.type}
                      onClick={() => handleAddBlock(block.type)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-left"
                    >
                      <span className="text-base opacity-70">{block.icon}</span>
                      <span>{block.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(groupedBlocks).length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhum bloco encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
