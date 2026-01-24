// =============================================
// ADD BLOCK DRAWER - Overlay panel with block library
// Canvas stays visible behind for real-time preview
// Click-to-add only (drag-and-drop removed for stability)
// =============================================

import { useMemo } from 'react';
import { blockRegistry } from '@/lib/builder/registry';
import { BlockDefinition } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { Plus, X, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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

// Category organization - 7 categorias consolidadas
type BlockCategoryType = 
  | 'banners'
  | 'products'
  | 'categories'
  | 'galleries'
  | 'content'
  | 'engagement'
  | 'forms'
  | 'layout';

const categoryLabels: Record<BlockCategoryType, string> = {
  banners: 'Banners',
  products: 'Produtos',
  categories: 'Categorias',
  galleries: 'Galerias',
  content: 'Conteúdo',
  engagement: 'Engajamento',
  forms: 'Formulários',
  layout: 'Layout',
};

const blockCategoryMapping: Record<string, BlockCategoryType> = {
  // Banners (seções de destaque)
  'HeroBanner': 'banners',
  'Hero': 'banners',
  'BannerProducts': 'banners',
  
  // Produtos (coleções e exibição de produtos)
  'CollectionSection': 'products',
  'ProductCarousel': 'products',
  'FeaturedProducts': 'products',
  'ProductCard': 'products',
  
  // Categorias
  'CategoryList': 'categories',
  'FeaturedCategories': 'categories',
  
  // Galerias (coleções de mídia)
  'VideoCarousel': 'galleries',
  'ImageCarousel': 'galleries',
  'ImageGallery': 'galleries',
  'LogosCarousel': 'galleries',
  
  // Conteúdo (itens únicos e textos)
  'RichText': 'content',
  'Button': 'content',
  'Image': 'content',
  'YouTubeVideo': 'content',
  'VideoUpload': 'content',
  'TextBanners': 'content',
  'StepsTimeline': 'content',
  'CountdownTimer': 'content',
  'StatsNumbers': 'content',
  'FAQ': 'content',
  'InfoHighlights': 'content',
  
  // Engajamento (interação e prova social)
  'Reviews': 'engagement',
  'NewsletterBlock': 'engagement',
  'ContactFormBlock': 'engagement',
  'MapBlock': 'engagement',
  'SocialFeedBlock': 'engagement',
  'PersonalizedProducts': 'engagement',
  'LivePurchases': 'engagement',
  'PricingTable': 'engagement',
  'PopupModal': 'engagement',
  
  // Formulários (Email Marketing / Quiz)
  'NewsletterForm': 'forms',
  'QuizEmbed': 'forms',
  
  // Layout
  'Section': 'layout',
  'Container': 'layout',
  'Columns': 'layout',
  'Spacer': 'layout',
  'Divider': 'layout',
};

// Visible blocks - removidos duplicados: Testimonials, AccordionBlock, ProductGrid, FeatureList, ContentColumns, Banner
const visibleBlockTypes = new Set([
  // Banners
  'HeroBanner', 'Hero', 'BannerProducts',
  // Produtos
  'CollectionSection', 'ProductCarousel', 'FeaturedProducts', 'ProductCard',
  // Categorias
  'CategoryList', 'FeaturedCategories',
  // Galerias
  'VideoCarousel', 'ImageCarousel', 'ImageGallery', 'LogosCarousel',
  // Conteúdo
  'RichText', 'Button', 'Image', 'YouTubeVideo', 'VideoUpload', 'TextBanners',
  'StepsTimeline', 'CountdownTimer', 'StatsNumbers', 'FAQ', 'InfoHighlights',
  // Engajamento
  'Reviews', 'NewsletterBlock', 'ContactFormBlock', 'MapBlock', 'SocialFeedBlock',
  'PersonalizedProducts', 'LivePurchases', 'PricingTable', 'PopupModal',
  // Formulários (Email Marketing / Quiz)
  'NewsletterForm', 'QuizEmbed',
  // Layout
  'Section', 'Container', 'Columns', 'Spacer', 'Divider',
]);

// Block item component - click to add only
function BlockItem({
  block,
  onAdd,
}: {
  block: BlockDefinition & { type: string };
  onAdd: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onAdd();
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-md border bg-background',
        'hover:border-primary hover:bg-primary/5 hover:shadow-sm',
        'transition-all duration-150 group text-left cursor-pointer'
      )}
    >
      <span className="text-sm font-medium flex-1 truncate">{block.label}</span>
      <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
      galleries: [],
      content: [],
      engagement: [],
      forms: [],
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
    'galleries',
    'content',
    'engagement',
    'forms',
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
            Clique em um bloco para adicioná-lo à página.
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
