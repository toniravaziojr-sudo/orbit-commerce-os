// =============================================
// ADD BLOCK DRAWER - Overlay panel with block library
// Canvas stays visible behind for real-time preview
// Supports both click-to-add and drag-and-drop
// =============================================

import { useMemo } from 'react';
import { blockRegistry } from '@/lib/builder/registry';
import { BlockDefinition } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { Plus, X, ArrowLeft, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDraggable } from '@dnd-kit/core';

interface AddBlockDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBlock: (type: string) => void;
}

// Category organization
type BlockCategoryType = 
  | 'banners'
  | 'products'
  | 'categories'
  | 'media'
  | 'content'
  | 'social-proof'
  | 'interactive'
  | 'info'
  | 'layout';

const categoryLabels: Record<BlockCategoryType, string> = {
  banners: 'Banners',
  products: 'Produtos / Coleções',
  categories: 'Categorias',
  media: 'Mídia',
  content: 'Conteúdo',
  'social-proof': 'Prova Social',
  interactive: 'Interativo',
  info: 'Informações',
  layout: 'Layout',
};

const blockCategoryMapping: Record<string, BlockCategoryType> = {
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

// Visible blocks (excluding system blocks)
const visibleBlockTypes = new Set([
  'HeroBanner', 'Hero', 'Banner', 'Image',
  'ProductGrid', 'ProductCarousel', 'FeaturedProducts', 'ProductCard', 'BannerProducts', 'CollectionSection',
  'CategoryList', 'FeaturedCategories',
  'VideoCarousel', 'ImageCarousel', 'ImageGallery', 'YouTubeVideo', 'VideoUpload',
  'RichText', 'Button', 'ContentColumns', 'FeatureList', 'StepsTimeline', 'CountdownTimer', 'LogosCarousel', 'StatsNumbers', 'AccordionBlock',
  'Testimonials',
  'NewsletterBlock', 'ContactFormBlock', 'MapBlock', 'SocialFeedBlock', 'PersonalizedProducts', 'LivePurchases', 'PricingTable', 'PopupModal',
  'InfoHighlights', 'FAQ',
  'Section', 'Container', 'Columns', 'Spacer', 'Divider',
]);

// Block item component - supports both click and drag
function BlockItem({
  block,
  onAdd,
}: {
  block: BlockDefinition & { type: string };
  onAdd: () => void;
}) {
  // Setup draggable for drag-and-drop
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `add-block-${block.type}`,
    data: {
      blockType: block.type,
      isNewBlock: true,
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent handlers from interfering
    e.preventDefault();
    console.log('[BlockItem] Clicked:', block.type);
    onAdd();
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-md border bg-background',
        'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
        'transition-all duration-150 group text-left',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted flex-shrink-0"
        title="Arraste para adicionar"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      
      {/* Clickable content */}
      <button
        onClick={handleClick}
        type="button"
        className="flex items-center gap-2 flex-1 text-left cursor-pointer min-w-0"
      >
        <span className="text-base flex-shrink-0">{block.icon}</span>
        <span className="text-sm font-medium flex-1 truncate">{block.label}</span>
        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </button>
    </div>
  );
}

export function AddBlockDrawer({
  open,
  onOpenChange,
  onAddBlock,
}: AddBlockDrawerProps) {
  // Group blocks by category
  const blocksByCategory = useMemo(() => {
    const grouped: Record<BlockCategoryType, (BlockDefinition & { type: string })[]> = {
      banners: [],
      products: [],
      categories: [],
      media: [],
      content: [],
      'social-proof': [],
      interactive: [],
      info: [],
      layout: [],
    };

    const allBlocks = blockRegistry.getAll();
    
    allBlocks.forEach(block => {
      if (!visibleBlockTypes.has(block.type)) return;
      
      const category = blockCategoryMapping[block.type];
      if (category && grouped[category]) {
        grouped[category].push({ ...block, type: block.type });
      }
    });

    return grouped;
  }, []);

  const categoryOrder: BlockCategoryType[] = [
    'banners',
    'products',
    'categories',
    'media',
    'content',
    'social-proof',
    'interactive',
    'info',
    'layout',
  ];

  const handleAddBlock = (type: string) => {
    console.log('[AddBlockDrawer] handleAddBlock called with type:', type);
    console.log('[AddBlockDrawer] Calling onAddBlock...');
    onAddBlock(type);
    console.log('[AddBlockDrawer] onAddBlock completed');
    // Keep drawer open so user can add more blocks if desired
    // User can close manually with X or clicking outside
  };

  if (!open) return null;

  return (
    <>
      {/* Semi-transparent overlay - click to close */}
      <div 
        className="fixed inset-0 bg-black/10 z-40 transition-opacity duration-200"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      
      {/* Sliding panel - overlays on top of sidebar */}
      <div 
        className={cn(
          'fixed left-0 top-0 h-full w-72 bg-background border-r shadow-xl z-50',
          'transform transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Plus className="h-4 w-4" />
            <span className="font-semibold text-sm">Adicionar seção</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Block categories */}
        <ScrollArea className="h-[calc(100vh-57px)]">
          <Accordion 
            type="multiple" 
            defaultValue={['banners', 'products']}
            className="px-2 py-2"
          >
            {categoryOrder.map((category) => {
              const blocks = blocksByCategory[category] || [];
              if (blocks.length === 0) return null;

              return (
                <AccordionItem key={category} value={category} className="border-b-0">
                  <AccordionTrigger className="py-2 px-2 text-sm font-medium hover:bg-muted/50 rounded-md [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center justify-between flex-1 mr-2">
                      <span>{categoryLabels[category]}</span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {blocks.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-2">
                    <div className="space-y-1">
                      {blocks.map((block) => (
                        <BlockItem
                          key={block.type}
                          block={block}
                          onAdd={() => handleAddBlock(block.type)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          
          {/* Helper text */}
          <div className="px-4 py-3 text-xs text-muted-foreground border-t mt-2">
            Clique em um bloco para adicioná-lo ao final da página.
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
