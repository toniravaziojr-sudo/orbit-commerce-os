// =============================================
// BLOCK PALETTE - Sidebar with available blocks
// =============================================

import { useState } from 'react';
import { blockRegistry, categoryLabels } from '@/lib/builder/registry';
import { BlockCategory, BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface BlockPaletteProps {
  onAddBlock: (type: string) => void;
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<BlockCategory>>(
    new Set(['content', 'ecommerce'])
  );

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

  const toggleCategory = (category: BlockCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const categories: BlockCategory[] = ['layout', 'header-footer', 'content', 'media', 'ecommerce', 'utilities'];

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b">
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

      {/* Block Categories */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {categories.map((category) => {
            const blocks = filterBlocks(blocksByCategory[category] || []);
            if (blocks.length === 0) return null;

            const isExpanded = expandedCategories.has(category) || !!search;

            return (
              <Collapsible
                key={category}
                open={isExpanded}
                onOpenChange={() => !search && toggleCategory(category)}
              >
                <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors">
                  <span>{categoryLabels[category]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {blocks.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-1">
                  <div className="grid grid-cols-2 gap-1.5 px-1">
                    {blocks.map((block) => (
                      <button
                        key={block.type}
                        onClick={() => onAddBlock(block.type)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-background',
                          'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
                          'transition-all duration-150 group cursor-pointer'
                        )}
                        title={`Adicionar ${block.label}`}
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">
                          {block.icon}
                        </span>
                        <span className="text-xs text-center truncate w-full font-medium">
                          {block.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Help text */}
      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          <Plus className="h-3 w-3 inline mr-1" />
          Clique para adicionar ao bloco selecionado
        </p>
      </div>
    </div>
  );
}
