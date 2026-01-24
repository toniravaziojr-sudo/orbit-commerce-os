// =============================================
// BLOCK PALETTE - Sidebar with available blocks (Accordion + Drag-and-Drop)
// =============================================

import { useState, useMemo } from 'react';
import { blockRegistry, categoryLabels } from '@/lib/builder/registry';
import { BlockCategory, BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, GripVertical, Plus } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface BlockPaletteProps {
  onAddBlock: (type: string) => void;
}

// New organized categories for essential blocks
type EssentialCategory = 
  | 'banners'
  | 'products'
  | 'categories'
  | 'media'
  | 'content'
  | 'social-proof'
  | 'interactive'
  | 'forms'
  | 'info'
  | 'layout';

const essentialCategoryLabels: Record<EssentialCategory, string> = {
  banners: 'Banners',
  products: 'Produtos / Coleções',
  categories: 'Categorias',
  media: 'Mídia',
  content: 'Conteúdo',
  'social-proof': 'Prova Social',
  interactive: 'Interativo',
  forms: 'Formulários',
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
  
  // Media
  'VideoCarousel': 'media',
  'ImageCarousel': 'media',
  'ImageGallery': 'media',
  'YouTubeVideo': 'media',
  'VideoUpload': 'media',
  
  // Content
  'RichText': 'content',
  'Button': 'content',
  'ContentColumns': 'content',
  'FeatureList': 'content',
  'StepsTimeline': 'content',
  'CountdownTimer': 'content',
  'LogosCarousel': 'content',
  'StatsNumbers': 'content',
  'AccordionBlock': 'content',
  
  // Social Proof
  'Testimonials': 'social-proof',
  
  // Interactive
  'NewsletterBlock': 'interactive',
  'ContactFormBlock': 'interactive',
  'MapBlock': 'interactive',
  'SocialFeedBlock': 'interactive',
  'PersonalizedProducts': 'interactive',
  'LivePurchases': 'interactive',
  'PricingTable': 'interactive',
  'PopupModal': 'interactive',
  
  // Forms (Email Marketing / Quiz)
  'NewsletterForm': 'forms',
  'QuizEmbed': 'forms',
  
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
  // Media
  'VideoCarousel',
  'ImageCarousel',
  'ImageGallery',
  'YouTubeVideo',
  'VideoUpload',
  // Content
  'RichText',
  'Button',
  'ContentColumns',
  'FeatureList',
  'StepsTimeline',
  'CountdownTimer',
  'LogosCarousel',
  'StatsNumbers',
  'AccordionBlock',
  // Social Proof
  'Testimonials',
  // Interactive
  'NewsletterBlock',
  'ContactFormBlock',
  'MapBlock',
  'SocialFeedBlock',
  'PersonalizedProducts',
  'LivePurchases',
  'PricingTable',
  'PopupModal',
  // Forms (Email Marketing / Quiz)
  'NewsletterForm',
  'QuizEmbed',
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

// Draggable block item component
function DraggableBlockItem({ 
  block, 
  onAddBlock 
}: { 
  block: BlockDefinition & { type: string };
  onAddBlock: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${block.type}`,
    data: {
      blockType: block.type,
      fromPalette: true,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onAddBlock(block.type)}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5 rounded-md border bg-background cursor-grab text-xs',
        'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
        'transition-all duration-150 group active:cursor-grabbing',
        isDragging && 'opacity-50 border-primary shadow-lg z-50'
      )}
      title={`Arraste para adicionar "${block.label}" ou clique`}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0" />
      <span className="font-medium flex-1 truncate">
        {block.label}
      </span>
      <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['banners', 'products']);

  // Group blocks by new category structure
  const blocksByCategory = useMemo(() => {
    const grouped: Record<EssentialCategory, (BlockDefinition & { type: string })[]> = {
      banners: [],
      products: [],
      categories: [],
      media: [],
      content: [],
      'social-proof': [],
      interactive: [],
      forms: [],
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

  const categoryOrder: EssentialCategory[] = [
    'banners',
    'products',
    'categories',
    'media',
    'content',
    'social-proof',
    'interactive',
    'forms',
    'info',
    'layout',
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar blocos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Block Categories - Accordion */}
      <ScrollArea className="flex-1">
        <Accordion 
          type="multiple" 
          value={effectiveExpandedCategories}
          onValueChange={setExpandedCategories}
          className="px-1.5 py-1"
        >
          {categoryOrder.map((category) => {
            const blocks = filterBlocks(blocksByCategory[category] || []);
            if (blocks.length === 0 && !search) return null;
            if (blocks.length === 0 && search) return null;

            return (
              <AccordionItem key={category} value={category} className="border-b-0">
                <AccordionTrigger className="py-1.5 px-1.5 text-xs font-medium hover:bg-muted/50 rounded-md [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center justify-between flex-1 mr-1.5">
                    <span>{essentialCategoryLabels[category]}</span>
                    <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                      {blocks.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0.5 pb-1.5">
                  <div className="space-y-0.5">
                    {blocks.map((block) => (
                      <DraggableBlockItem
                        key={block.type}
                        block={block}
                        onAddBlock={onAddBlock}
                      />
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
      <div className="p-2 border-t bg-muted/30">
        <p className="text-[10px] text-muted-foreground text-center">
          <GripVertical className="h-2.5 w-2.5 inline mr-0.5" />
          Arraste ou clique para adicionar
        </p>
      </div>
    </div>
  );
}
