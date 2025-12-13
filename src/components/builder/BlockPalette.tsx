// =============================================
// BLOCK PALETTE - Sidebar with available blocks
// =============================================

import { useState } from 'react';
import { blockRegistry, categoryLabels } from '@/lib/builder/registry';
import { BlockCategory, BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, GripVertical } from 'lucide-react';

interface BlockPaletteProps {
  onAddBlock: (type: string) => void;
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<BlockCategory | null>('content');

  // Group blocks by category
  const blocksByCategory = Object.entries(blockRegistry).reduce((acc, [type, def]) => {
    const category = def.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push({ type, ...def });
    return acc;
  }, {} as Record<BlockCategory, (BlockDefinition & { type: string })[]>);

  // Filter blocks by search
  const filterBlocks = (blocks: (BlockDefinition & { type: string })[]) => {
    if (!search) return blocks;
    const searchLower = search.toLowerCase();
    return blocks.filter(
      block => 
        block.label.toLowerCase().includes(searchLower) ||
        block.type.toLowerCase().includes(searchLower)
    );
  };

  const categories: BlockCategory[] = ['layout', 'header-footer', 'content', 'ecommerce'];

  return (
    <div className="h-full flex flex-col bg-card border-r">
      <div className="p-3 border-b">
        <h3 className="font-semibold mb-2 text-sm">Blocos</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar blocos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {categories.map((category) => {
            const blocks = filterBlocks(blocksByCategory[category] || []);
            if (blocks.length === 0) return null;

            const isExpanded = expandedCategory === category || !!search;

            return (
              <div key={category} className="mb-2">
                <button
                  onClick={() => setExpandedCategory(isExpanded && !search ? null : category)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <span>{categoryLabels[category]}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {blocks.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-2 gap-1.5 mt-1 px-1">
                    {blocks.map((block) => (
                      <button
                        key={block.type}
                        onClick={() => onAddBlock(block.type)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded border bg-background',
                          'hover:border-primary hover:bg-primary/5 transition-colors',
                          'group cursor-grab active:cursor-grabbing'
                        )}
                        title={block.label}
                      >
                        <div className="relative">
                          <span className="text-xl">{block.icon}</span>
                          <GripVertical className="absolute -left-3 top-0 h-4 w-4 opacity-0 group-hover:opacity-50" />
                        </div>
                        <span className="text-xs text-center truncate w-full">
                          {block.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 border-t text-xs text-muted-foreground">
        Clique para adicionar ou arraste para posicionar
      </div>
    </div>
  );
}
