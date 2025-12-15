// =============================================
// BLOCK PALETTE - Sidebar with available blocks (Accordion + Drag-and-Drop)
// =============================================

import { useState, useMemo } from 'react';
import { blockRegistry, categoryLabels } from '@/lib/builder/registry';
import { BlockCategory, BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface BlockPaletteProps {
  onAddBlock: (type: string) => void;
}

// New organized categories for essential blocks
type EssentialCategory = 
  | 'banners'
  | 'products'
  | 'categories'
  | 'content'
  | 'social-proof'
  | 'info'
  | 'layout';

const essentialCategoryLabels: Record<EssentialCategory, string> = {
  banners: 'Banners',
  products: 'Produtos / Coleções',
  categories: 'Categorias',
  content: 'Conteúdo',
  'social-proof': 'Prova Social',
  info: 'Informações',
  layout: 'Layout',
};

// Map block types to new categories
const blockCategoryMapping: Record<string, EssentialCategory> = {
  // Banners
  'HeroBanner': 'banners',
  'Hero': 'banners',
  'Banner': 'banners',
  'Image': 'banners',
  
  // Products
  'ProductGrid': 'products',
  'ProductCarousel': 'products',
  'FeaturedProducts': 'products',
  'ProductCard': 'products',
  'BannerProducts': 'products',
  'CollectionSection': 'products',
  
  // Categories
  'CategoryList': 'categories',
  'FeaturedCategories': 'categories',
  
  // Content
  'RichText': 'content',
  'Button': 'content',
  'TextBanners': 'content',
  'YouTubeVideo': 'content',
  
  // Social Proof
  'Reviews': 'social-proof',
  'Testimonials': 'social-proof',
  
  // Info
  'InfoHighlights': 'info',
  'FAQ': 'info',
  
  // Layout
  'Section': 'layout',
  'Container': 'layout',
  'Columns': 'layout',
  'Spacer': 'layout',
  'Divider': 'layout',
};

// Blocks to show in palette (excluding system blocks like Page, Header, Footer, etc.)
const visibleBlockTypes = new Set([
  // Banners
  'HeroBanner',
  'Hero',
  'Banner',
  'Image',
  // Products
  'ProductGrid',
  'ProductCarousel',
  'FeaturedProducts',
  'ProductCard',
  'BannerProducts',
  'CollectionSection',
  // Categories
  'CategoryList',
  'FeaturedCategories',
  // Content
  'RichText',
  'Button',
  'TextBanners',
  'YouTubeVideo',
  // Social Proof
  'Reviews',
  'Testimonials',
  // Info
  'InfoHighlights',
  'FAQ',
  // Layout
  'Section',
  'Container',
  'Columns',
  'Spacer',
  'Divider',
]);

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['banners', 'products']);
  const [draggedType, setDraggedType] = useState<string | null>(null);

  // Group blocks by new category structure
  const blocksByCategory = useMemo(() => {
    const grouped: Record<EssentialCategory, (BlockDefinition & { type: string })[]> = {
      banners: [],
      products: [],
      categories: [],
      content: [],
      'social-proof': [],
      info: [],
      layout: [],
    };

    // Get all blocks from registry
    const allBlocks = blockRegistry.getAll();
    
    allBlocks.forEach(block => {
      // Only include visible blocks
      if (!visibleBlockTypes.has(block.type)) return;
      
      const category = blockCategoryMapping[block.type];
      if (category && grouped[category]) {
        grouped[category].push({ ...block, type: block.type });
      }
    });

    return grouped;
  }, []);

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

  // Determine which categories to show expanded based on search
  const effectiveExpandedCategories = useMemo(() => {
    if (!search) return expandedCategories;
    // When searching, expand all categories that have matching blocks
    const matching: string[] = [];
    Object.entries(blocksByCategory).forEach(([category, blocks]) => {
      const filtered = filterBlocks(blocks);
      if (filtered.length > 0) matching.push(category);
    });
    return matching;
  }, [search, blocksByCategory, expandedCategories]);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('blockType', blockType);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedType(blockType);
    
    // Set a custom drag image (optional)
    const dragEl = e.currentTarget as HTMLElement;
    if (dragEl) {
      e.dataTransfer.setDragImage(dragEl, 20, 20);
    }
  };

  const handleDragEnd = () => {
    setDraggedType(null);
  };

  const categoryOrder: EssentialCategory[] = [
    'banners',
    'products',
    'categories',
    'content',
    'social-proof',
    'info',
    'layout',
  ];

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

      {/* Block Categories - Accordion */}
      <ScrollArea className="flex-1">
        <Accordion 
          type="multiple" 
          value={effectiveExpandedCategories}
          onValueChange={setExpandedCategories}
          className="px-2 py-1"
        >
          {categoryOrder.map((category) => {
            const blocks = filterBlocks(blocksByCategory[category] || []);
            if (blocks.length === 0 && !search) return null;
            if (blocks.length === 0 && search) return null;

            return (
              <AccordionItem key={category} value={category} className="border-b-0">
                <AccordionTrigger className="py-2 px-2 text-sm font-medium hover:bg-muted/50 rounded-md [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center justify-between flex-1 mr-2">
                    <span>{essentialCategoryLabels[category]}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {blocks.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-2">
                  <div className="space-y-1">
                    {blocks.map((block) => (
                      <div
                        key={block.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, block.type)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onAddBlock(block.type)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-background cursor-grab',
                          'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
                          'transition-all duration-150 group active:cursor-grabbing',
                          draggedType === block.type && 'opacity-50 border-primary'
                        )}
                        title={`Arraste para adicionar "${block.label}" ou clique`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                        <span className="text-lg group-hover:scale-110 transition-transform">
                          {block.icon}
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">
                          {block.label}
                        </span>
                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        
        {/* No results message */}
        {search && Object.values(blocksByCategory).every(blocks => filterBlocks(blocks).length === 0) && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            <p>Nenhum bloco encontrado para "{search}"</p>
          </div>
        )}
      </ScrollArea>

      {/* Help text */}
      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          <GripVertical className="h-3 w-3 inline mr-1" />
          Arraste para o canvas ou clique para adicionar
        </p>
      </div>
    </div>
  );
}
