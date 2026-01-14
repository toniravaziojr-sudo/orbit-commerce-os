// =============================================
// ADD BLOCK DRAWER - Modal/Sheet with block library
// =============================================

import { useMemo } from 'react';
import { blockRegistry } from '@/lib/builder/registry';
import { BlockDefinition } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

// Block item component
function BlockItem({
  block,
  onAdd,
}: {
  block: BlockDefinition & { type: string };
  onAdd: () => void;
}) {
  return (
    <button
      onClick={onAdd}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-md border bg-background',
        'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
        'transition-all duration-150 group text-left'
      )}
    >
      <span className="text-base flex-shrink-0">{block.icon}</span>
      <span className="text-sm font-medium flex-1">{block.label}</span>
      <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
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
    onAddBlock(type);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar seção
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-65px)]">
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
