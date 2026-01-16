// =============================================
// BLOCK RENDERER - Renders blocks recursively
// Refactored: Layout and content blocks moved to separate files
// Supports Safe Mode (?safe=1) for debugging
// Wrapped with BlockErrorBoundary for diagnostics
// =============================================

import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { isEssentialBlock, getEssentialBlockReason } from '@/lib/builder/essentialBlocks';
import { isBlockRequired, getRequiredBlockInfo, canDeleteBlock } from '@/lib/builder/pageContracts';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AddBlockButton } from './AddBlockButton';
import { BlockQuickActions } from './BlockQuickActions';
import { BlockErrorBoundary } from './BlockErrorBoundary';

// Layout blocks (refactored)
import { 
  PageBlock,
  SectionBlock, 
  ContainerBlock, 
  GridBlock, 
  ColumnBlock, 
  ColumnsBlock 
} from './blocks/layout';

// Content blocks (refactored)
import { 
  TextBlock, 
  RichTextBlock, 
  ImageBlock, 
  ButtonBlock, 
  SpacerBlock, 
  DividerBlock, 
  HeroBlock 
} from './blocks/content';

// Interactive blocks (refactored)
import { FAQBlock, TestimonialsBlock, NewsletterBlock, ContactFormBlock, MapBlock, SocialFeedBlock, PersonalizedProductsBlock, LivePurchasesBlock, PricingTableBlock, PopupModalBlock } from './blocks/interactive';

// E-commerce components (refactored)
import { ProductCTAs, ProductRatingSummary } from './blocks/ecommerce';

// Existing block components (already in separate files)
import { ProductGridBlock as ProductGridBlockComponent } from './blocks/ProductGridBlock';
import { ProductCarouselBlock as ProductCarouselBlockComponent } from './blocks/ProductCarouselBlock';
import { FeaturedProductsBlock as FeaturedProductsBlockComponent } from './blocks/FeaturedProductsBlock';
import { CategoryListBlock as CategoryListBlockComponent } from './blocks/CategoryListBlock';
import { HeroBannerBlock as HeroBannerBlockComponent } from './blocks/HeroBannerBlock';
import { CollectionSectionBlock as CollectionSectionBlockComponent } from './blocks/CollectionSectionBlock';
import { InfoHighlightsBlock as InfoHighlightsBlockComponent } from './blocks/InfoHighlightsBlock';
import { BannerProductsBlock as BannerProductsBlockComponent } from './blocks/BannerProductsBlock';
import { YouTubeVideoBlock as YouTubeVideoBlockComponent } from './blocks/YouTubeVideoBlock';
import { ReviewsBlock as ReviewsBlockComponent } from './blocks/ReviewsBlock';
import { FeaturedCategoriesBlock as FeaturedCategoriesBlockComponent } from './blocks/FeaturedCategoriesBlock';
import { TextBannersBlock as TextBannersBlockComponent } from './blocks/TextBannersBlock';
import { VideoUploadBlock as VideoUploadBlockComponent } from './blocks/VideoUploadBlock';
import { TrackingLookupBlock as TrackingLookupBlockComponent } from './blocks/TrackingLookupBlock';
import { BlogListingBlock as BlogListingBlockComponent } from './blocks/BlogListingBlock';
import { BlogPostDetailBlock as BlogPostDetailBlockComponent } from './blocks/BlogPostDetailBlock';
import { PageContentBlock as PageContentBlockComponent } from './blocks/PageContentBlock';
import { CustomBlockRenderer as CustomBlockRendererComponent } from './blocks/CustomBlockRenderer';
import { VideoCarouselBlock as VideoCarouselBlockComponent } from './blocks/VideoCarouselBlock';
import { ImageCarouselBlock as ImageCarouselBlockComponent } from './blocks/ImageCarouselBlock';
import { FeatureListBlock as FeatureListBlockComponent } from './blocks/FeatureListBlock';
import { ContentColumnsBlock as ContentColumnsBlockComponent } from './blocks/ContentColumnsBlock';
import { StepsTimelineBlock as StepsTimelineBlockComponent } from './blocks/StepsTimelineBlock';
import { CountdownTimerBlock as CountdownTimerBlockComponent } from './blocks/CountdownTimerBlock';
import { LogosCarouselBlock as LogosCarouselBlockComponent } from './blocks/LogosCarouselBlock';
import { StatsNumbersBlock as StatsNumbersBlockComponent } from './blocks/StatsNumbersBlock';
import { ImageGalleryBlock as ImageGalleryBlockComponent } from './blocks/ImageGalleryBlock';
import { AccordionBlock as AccordionBlockComponent } from './blocks/AccordionBlock';
import { CartDemoBlock } from './blocks/CartDemoBlock';
import { CheckoutDemoBlock } from './blocks/CheckoutDemoBlock';
import { CategoryBannerBlock as CategoryBannerBlockComponent } from './blocks/CategoryBannerBlock';
import { CategoryPageLayout as CategoryPageLayoutComponent } from './blocks/CategoryPageLayout';

// Offer Slot Blocks
import { CompreJuntoSlotBlock, CrossSellSlotBlock, OrderBumpSlotBlock, UpsellSlotBlock } from './blocks/slots';

// Storefront components
import { StorefrontFooterContent } from '@/components/storefront/StorefrontFooterContent';
import { StorefrontHeaderContent } from '@/components/storefront/StorefrontHeaderContent';
import { ProductPageSections } from '@/components/storefront/ProductPageSections';
import { MiniCartDrawer } from '@/components/storefront/MiniCartDrawer';
import { CartContent } from '@/components/storefront/cart/CartContent';

// Product page components (conforme REGRAS.md)
import { ProductBadges } from '@/components/storefront/product/ProductBadges';
import { PaymentBadges } from '@/components/storefront/product/PaymentBadges';
import { ShippingCalculator } from '@/components/storefront/product/ShippingCalculator';
import { GuaranteeBadges } from '@/components/storefront/product/GuaranteeBadges';
import { ProductVariantSelector } from '@/components/storefront/product/ProductVariantSelector';
import { FloatingCartButton } from '@/components/storefront/FloatingCartButton';
import { useProductVariants } from '@/hooks/useProductVariants';

// Note: StorefrontOrdersList and StorefrontOrderDetail are NOT imported here
// to avoid circular dependency (they import BlockRenderer).
// The OrdersListBlock and OrderDetailBlock only render placeholders in edit mode,
// and in production they are rendered by StorefrontOrdersList/StorefrontOrderDetail pages directly.
import { CheckoutStepWizard } from '@/components/storefront/checkout/CheckoutStepWizard';
import { ThankYouContent } from '@/components/storefront/ThankYouContent';

// UI components
import { Button } from '@/components/ui/button';
import { Check, MessageCircle } from 'lucide-react';

interface BlockRendererProps {
  node: BlockNode;
  context: BlockRenderContext;
  isSelected?: boolean;
  isEditing?: boolean;
  isInteractMode?: boolean;
  isSafeMode?: boolean; // Safe mode - render only placeholders
  onSelect?: (id: string) => void;
  onAddBlock?: (type: string, parentId: string, index: number) => void;
  onMoveBlock?: (blockId: string, direction: 'up' | 'down') => void;
  onDuplicateBlock?: (blockId: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onToggleHidden?: (blockId: string) => void;
  siblingIndex?: number;
  siblingsCount?: number;
  parentId?: string;
}

export function BlockRenderer({ 
  node, 
  context, 
  isSelected = false,
  isEditing = false,
  isInteractMode = false,
  isSafeMode = false,
  onSelect,
  onAddBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onToggleHidden,
  siblingIndex = 0,
  siblingsCount = 1,
  parentId,
}: BlockRendererProps) {
  const definition = blockRegistry.get(node.type);
  
  if (!definition) {
    if (!isEditing) return null;
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500 rounded text-amber-700 dark:text-amber-400 text-sm">
        ⚠️ Bloco removido/legado: {node.type}
        <p className="text-xs mt-1 opacity-75">Este bloco não existe mais. Remova-o para evitar problemas.</p>
      </div>
    );
  }

  // Don't render hidden blocks in preview/public mode
  if (node.hidden && !isEditing) return null;

  // SAFE MODE: Render simple placeholders for all blocks except layout blocks
  // This prevents #300 errors by avoiding complex block components with hooks
  const isLayoutBlock = ['Page', 'Section', 'Container', 'Grid', 'Column', 'Columns'].includes(node.type);
  if (isSafeMode && !isLayoutBlock) {
    return (
      <div 
        className={cn(
          "p-4 border-2 border-dashed rounded-lg m-2 transition-all",
          isSelected ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/50"
        )}
        onClick={(e) => {
          if (onSelect) {
            e.stopPropagation();
            onSelect(node.id);
          }
        }}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{node.type}</span>
          <span>{definition.label}</span>
          {node.hidden && <span className="text-yellow-500">(oculto)</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Safe Mode - Bloco simplificado para debug
        </p>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing && onSelect) {
      e.stopPropagation();
      onSelect(node.id);
    }
  };

  // Render children with "+" buttons between them
  // Check if this is a root Page block - should NOT show AddBlockButtons between Header/Section/Footer
  const isRootPage = node.type === 'Page' && !parentId;
  
  const renderChildren = () => {
    if (!node.children?.length) {
      // For root Page, never show AddBlockButton (blocks are added via left menu)
      if (isRootPage) {
        return null;
      }
      if (definition.canHaveChildren && isEditing && onAddBlock) {
        return (
          <div className="py-4 group">
            <AddBlockButton
              parentId={node.id}
              index={0}
              onAddBlock={onAddBlock}
              className="opacity-40"
            />
          </div>
        );
      }
      return null;
    }
    
    return (
      <>
        {node.children.map((child, index) => (
          <div key={child.id} className="group/block">
            {/* NO AddBlockButton for root Page children (Header/Section/Footer) */}
            {/* Blocks are added ONLY via left menu - no inline buttons */}
            {!isRootPage && index === 0 && isEditing && onAddBlock && definition.canHaveChildren && (
              <div className="py-1">
                <AddBlockButton parentId={node.id} index={0} onAddBlock={onAddBlock} />
              </div>
            )}
            
            <BlockRenderer
              node={child}
              context={context}
              isEditing={isEditing}
              isInteractMode={isInteractMode}
              isSafeMode={isSafeMode}
              onSelect={onSelect}
              onAddBlock={onAddBlock}
              onMoveBlock={onMoveBlock}
              onDuplicateBlock={onDuplicateBlock}
              onDeleteBlock={onDeleteBlock}
              onToggleHidden={onToggleHidden}
              siblingIndex={index}
              siblingsCount={node.children!.length}
              parentId={node.id}
            />

            {/* Render afterHeaderSlot after Header block */}
            {child.type === 'Header' && context.afterHeaderSlot && (
              <div className="w-full">{context.afterHeaderSlot}</div>
            )}
            
            {/* NO AddBlockButton for root Page children */}
            {!isRootPage && isEditing && onAddBlock && definition.canHaveChildren && (
              <div className="py-1">
                <AddBlockButton parentId={node.id} index={index + 1} onAddBlock={onAddBlock} />
              </div>
            )}
          </div>
        ))}
      </>
    );
  };

  const BlockComponent = getBlockComponent(node.type);
  
  const canMoveUp = siblingIndex > 0;
  const canMoveDown = siblingIndex < siblingsCount - 1;
  const isRemovable = definition.isRemovable !== false;
  
  const pageType = context.pageType || 'home';
  
  // Check both essential blocks (old system) and required blocks (new page contracts)
  const isEssential = isEssentialBlock(node.type, pageType);
  const isRequired = isBlockRequired(pageType, node.type);
  const isLockedBlock = isEssential || isRequired;
  
  // Get reason for locked status
  let essentialReason: string | undefined;
  if (isEssential) {
    essentialReason = getEssentialBlockReason(node.type, pageType) || undefined;
  } else if (isRequired) {
    const requiredInfo = getRequiredBlockInfo(pageType, node.type);
    essentialReason = requiredInfo ? `Estrutura obrigatória: ${requiredInfo.description}` : 'Este bloco é necessário para o funcionamento da página';
  }
  
  // Block cannot be deleted if it's locked
  const canDelete = canDeleteBlock(pageType, node.type) && !isEssential;

  // Check if this is a structural Section (direct child of root) - should be completely invisible
  const isStructuralSection = node.type === 'Section' && parentId === 'root';
  
  // For structural Sections: render children directly, NO wrappers, NO AddBlockButton
  // Blocks are added ONLY via the left menu. No extra spacing/margins.
  // This applies in ALL modes (editing, preview, public) - structural sections are always invisible
  if (isStructuralSection) {
    // If empty and editing, show nothing (blocks are added via left menu)
    if (!node.children?.length) {
      return null;
    }
    
    return (
      <>
        {node.children.map((child, index) => (
          <BlockRenderer
            key={child.id}
            node={child}
            context={context}
            isEditing={isEditing}
            isInteractMode={isInteractMode}
            isSafeMode={isSafeMode}
            onSelect={onSelect}
            onAddBlock={onAddBlock}
            onMoveBlock={onMoveBlock}
            onDuplicateBlock={onDuplicateBlock}
            onDeleteBlock={onDeleteBlock}
            onToggleHidden={onToggleHidden}
            siblingIndex={index}
            siblingsCount={node.children!.length}
            parentId={node.id}
          />
        ))}
      </>
    );
  }

  return (
    <div
      data-block-id={node.id}
      onClick={handleClick}
      className={cn(
        'relative transition-all group/block-actions',
        isEditing && 'cursor-pointer hover:outline hover:outline-2 hover:outline-primary/50',
        isSelected && isEditing && 'outline outline-2 outline-primary ring-2 ring-primary/20',
        node.hidden && isEditing && 'opacity-40'
      )}
    >
      {isSelected && isEditing && (
        <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-t z-10 flex items-center gap-1">
          {definition.label}
          {node.hidden && <span className="text-xs">(oculto)</span>}
          {/* Header/Footer: show message directing to Theme Settings */}
          {['Header', 'Footer'].includes(node.type) && (
            <span className="ml-2 text-primary-foreground/80">
              → Configurações do tema
            </span>
          )}
        </div>
      )}
      
      {/* Quick actions - NOT shown for Header/Footer (they use Theme Settings) */}
      {isEditing && node.type !== 'Page' && !['Header', 'Footer'].includes(node.type) && (
        <BlockQuickActions
          blockId={node.id}
          blockType={node.type}
          isRemovable={isRemovable && canDelete}
          isEssential={isLockedBlock}
          essentialReason={essentialReason}
          isHidden={node.hidden}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => onMoveBlock?.(node.id, 'up')}
          onMoveDown={() => onMoveBlock?.(node.id, 'down')}
          onDuplicate={() => onDuplicateBlock?.(node.id)}
          onDelete={() => onDeleteBlock?.(node.id)}
          onToggleHidden={() => onToggleHidden?.(node.id)}
          viewport={context.viewport}
        />
      )}
      
      <BlockErrorBoundary
        blockId={node.id}
        blockType={node.type}
        pageType={pageType}
        isEditing={isEditing}
        isSafeMode={isSafeMode}
      >
        <BlockComponent 
          {...node.props} 
          context={context}
          isEditing={isEditing}
          isInteractMode={isInteractMode}
          block={node}
        >
          {renderChildren()}
        </BlockComponent>
      </BlockErrorBoundary>
    </div>
  );
}

// Block component mapping
function getBlockComponent(type: string): React.ComponentType<any> {
  const components: Record<string, React.ComponentType<any>> = {
    // Layout blocks (refactored)
    Page: PageBlock,
    Section: SectionBlock,
    Container: ContainerBlock,
    Grid: GridBlock,
    Column: ColumnBlock,
    Columns: ColumnsBlock,
    
    // Content blocks (refactored)
    Text: TextBlock,
    RichText: RichTextBlock,
    Image: ImageBlock,
    Button: ButtonBlock,
    Spacer: SpacerBlock,
    Divider: DividerBlock,
    Hero: HeroBlock,
    
    // Interactive blocks (refactored)
    FAQ: FAQBlock,
    Testimonials: TestimonialsBlock,
    Newsletter: NewsletterBlock,
    ContactForm: ContactFormBlock,
    Map: MapBlock,
    SocialFeed: SocialFeedBlock,
    PersonalizedProducts: PersonalizedProductsBlock,
    LivePurchases: LivePurchasesBlock,
    PricingTable: PricingTableBlock,
    PopupModal: PopupModalBlock,
    
    // Header / Footer
    Header: HeaderBlock,
    Footer: FooterBlock,
    
    // E-commerce blocks
    ProductGrid: ProductGridBlock,
    ProductCarousel: ProductCarouselBlock,
    CategoryList: CategoryListBlock,
    FeaturedProducts: FeaturedProductsBlock,
    ProductCard: ProductCardBlock,
    ProductDetails: ProductDetailsBlock,
    CartSummary: CartSummaryBlock,
    CheckoutSteps: CheckoutStepsBlock,
    Cart: CartBlock,
    Checkout: CheckoutBlock,
    ThankYou: ThankYouBlock,
    
    // Category page layout (system block)
    CategoryPageLayout: CategoryPageLayoutBlock,
    
    // Essential blocks
    HeroBanner: HeroBannerBlockWrapper,
    CollectionSection: CollectionSectionBlockWrapper,
    InfoHighlights: InfoHighlightsBlockWrapper,
    BannerProducts: BannerProductsBlockWrapper,
    YouTubeVideo: YouTubeVideoBlockWrapper,
    Reviews: ReviewsBlockWrapper,
    FeaturedCategories: FeaturedCategoriesBlockWrapper,
    TextBanners: TextBannersBlockWrapper,
    VideoUpload: VideoUploadBlockWrapper,
    CategoryBanner: CategoryBannerBlockWrapper,
    
    // Account blocks
    AccountHub: AccountHubBlock,
    OrdersList: OrdersListBlock,
    OrderDetail: OrderDetailBlock,
    
    // System blocks
    TrackingLookup: TrackingLookupBlockWrapper,
    BlogListing: BlogListingBlockWrapper,
    BlogPostDetail: BlogPostDetailBlockWrapper,
    PageContent: PageContentBlock,
    CustomBlock: CustomBlockWrapper,
    HTMLSection: HTMLSectionWrapper,
    VideoCarousel: VideoCarouselBlockWrapper,
    ImageCarousel: ImageCarouselBlockWrapper,
    
    // New blocks
    FeatureList: FeatureListBlockWrapper,
    ContentColumns: ContentColumnsBlockWrapper,
    StepsTimeline: StepsTimelineBlockWrapper,
    CountdownTimer: CountdownTimerBlockWrapper,
    LogosCarousel: LogosCarouselBlockWrapper,
    StatsNumbers: StatsNumbersBlockWrapper,
    ImageGallery: ImageGalleryBlockWrapper,
    AccordionBlock: AccordionBlockBlockWrapper,
    
    // Offer Slot Blocks
    CompreJuntoSlot: (props: any) => <CompreJuntoSlotBlock {...props} isEditing={props.isEditing} />,
    CrossSellSlot: (props: any) => <CrossSellSlotBlock {...props} isEditing={props.isEditing} />,
    OrderBumpSlot: (props: any) => <OrderBumpSlotBlock {...props} isEditing={props.isEditing} />,
    UpsellSlot: (props: any) => <UpsellSlotBlock {...props} isEditing={props.isEditing} />,
  };

  return components[type] || FallbackBlock;
}

function FallbackBlock({ children }: { children?: React.ReactNode }) {
  return <div className="p-4 bg-muted rounded">{children}</div>;
}

// ========== HEADER / FOOTER ==========

function HeaderBlock({ context, isEditing, block }: any) {
  const { settings, headerMenu, categories, tenantSlug } = context || {};
  
  const { data: pagesData } = useQuery({
    queryKey: ['header-pages-for-menu', settings?.tenant_id],
    queryFn: async () => {
      if (!settings?.tenant_id) return [];
      const { data } = await supabase
        .from('store_pages')
        .select('id, slug, type')
        .eq('tenant_id', settings.tenant_id)
        .eq('is_published', true);
      return data || [];
    },
    enabled: !!settings?.tenant_id,
  });
  
  const headerConfig = { ...block, props: block?.props || {} };
  
  const storeSettings = settings ? {
    logo_url: settings.logo_url,
    store_name: settings.store_name,
    primary_color: settings.primary_color,
    social_whatsapp: settings.social_whatsapp,
    contact_phone: settings.contact_phone,
    contact_email: settings.contact_email,
    contact_address: settings.contact_address,
    contact_support_hours: settings.contact_support_hours,
    social_facebook: settings.social_facebook,
    social_instagram: settings.social_instagram,
  } : null;
  
  const menuItems = Array.isArray(headerMenu) ? headerMenu : (headerMenu?.items || []);
  
  return (
    <StorefrontHeaderContent 
      tenantSlug={tenantSlug || ''} 
      headerConfig={headerConfig}
      storeSettings={storeSettings}
      menuItems={menuItems}
      categories={categories || []}
      pagesData={pagesData || []}
      totalCartItems={0}
      isEditing={isEditing}
      tenantId={settings?.tenant_id}
      viewportOverride={context.viewport}
    />
  );
}

function FooterBlock({ context, isEditing, block }: any) {
  const footerConfig = { ...block, props: block?.props || {} };
  
  return (
    <StorefrontFooterContent 
      tenantSlug={context?.tenantSlug || ''} 
      footerConfig={footerConfig}
      isEditing={isEditing} 
    />
  );
}

// ========== E-COMMERCE BLOCKS ==========

function ProductGridBlock({ title, source, categoryId, columns = 4, limit = 8, showPrice = true, showButton = true, buttonText = 'Ver produto', context, isEditing }: any) {
  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6 px-4">{title}</h2>}
      <ProductGridBlockComponent
        source={source}
        categoryId={categoryId}
        limit={limit}
        columns={columns}
        showPrice={showPrice}
        showButton={showButton}
        buttonText={buttonText}
        context={context}
        isEditing={isEditing}
      />
    </div>
  );
}

function ProductCarouselBlock({ title, source, categoryId, limit = 8, showPrice = true, showButton = true, buttonText = 'Ver produto', context, isEditing }: any) {
  return (
    <ProductCarouselBlockComponent
      title={title}
      source={source}
      categoryId={categoryId}
      limit={limit}
      showPrice={showPrice}
      showButton={showButton}
      buttonText={buttonText}
      context={context}
      isEditing={isEditing}
    />
  );
}

function CategoryListBlock({ title, source, columns = 3, limit = 6, layout = 'grid', showImage = true, showDescription = false, context, isEditing }: any) {
  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6 px-4">{title}</h2>}
      <CategoryListBlockComponent
        source={source}
        layout={layout}
        limit={limit}
        columns={columns}
        showImage={showImage}
        showDescription={showDescription}
        context={context}
        isEditing={isEditing}
      />
    </div>
  );
}

function FeaturedProductsBlock({ title, productIds, limit = 4, columns = 4, showPrice = true, showButton = true, buttonText = 'Ver produto', context, isEditing }: any) {
  return (
    <FeaturedProductsBlockComponent
      title={title}
      productIds={productIds}
      limit={limit}
      columns={columns}
      showPrice={showPrice}
      showButton={showButton}
      buttonText={buttonText}
      context={context}
      isEditing={isEditing}
    />
  );
}

function ProductCardBlock({ productId, showPrice = true, showButton = true, isEditing }: any) {
  const { data: product, isLoading } = useQuery({
    queryKey: ['product-card', productId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`id, name, price, status, product_images (id, url, alt_text, is_primary, sort_order)`);
      
      if (!productId || productId === '_auto') {
        query = query.eq('status', 'active').limit(1);
      } else {
        query = query.eq('id', productId);
      }
      
      const { data, error } = await query.single();
      if (error) return null;
      return data;
    },
    enabled: !!productId || isEditing,
  });

  const primaryImage = product?.product_images?.find((img: any) => img.is_primary) || product?.product_images?.[0];

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg p-4 animate-pulse">
        <div className="aspect-square bg-muted rounded mb-3" />
        <div className="h-4 bg-muted rounded mb-2" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!product && !isEditing) return null;

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="aspect-square bg-muted rounded mb-3 flex items-center justify-center overflow-hidden">
        {primaryImage?.url ? (
          <img src={primaryImage.url} alt={product?.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-muted-foreground text-4xl">📦</span>
        )}
      </div>
      <h3 className="font-medium truncate">{product?.name || 'Produto'}</h3>
      {showPrice && (
        <p className="text-primary font-bold">
          R$ {(product?.price || 99.90).toFixed(2).replace('.', ',')}
        </p>
      )}
      {showButton && (
        <button className="w-full mt-2 bg-primary text-primary-foreground py-2 rounded text-sm hover:bg-primary/90">
          Comprar
        </button>
      )}
      {isEditing && !product && (
        <p className="text-xs text-muted-foreground mt-2 text-center">[Selecione um produto]</p>
      )}
    </div>
  );
}

function ProductDetailsBlock({ exampleProductId, context, isEditing, isInteractMode }: any) {
  const productSettings = context?.productSettings || {};
  
  // Toggles conforme REGRAS.md (apenas os 11 listados)
  const showGallery = productSettings.showGallery !== false;
  const showDescription = productSettings.showDescription !== false;
  const showVariants = productSettings.showVariants !== false;
  const showStock = productSettings.showStock !== false;
  const showReviews = productSettings.showReviews !== false;
  const showBuyTogether = productSettings.showBuyTogether !== false;
  const showRelatedProducts = productSettings.showRelatedProducts !== false;
  const openMiniCartOnAdd = productSettings.openMiniCartOnAdd !== false;
  const showFloatingCart = productSettings.showFloatingCart !== false;
  const showWhatsAppButton = productSettings.showWhatsAppButton !== false;
  const showAddToCartButton = productSettings.showAddToCartButton !== false;
  const buyNowButtonText = productSettings.buyNowButtonText || 'Comprar agora';
  
  // Theme settings for mini-cart (não é toggle da página, é do tema)
  const miniCartEnabled = context?.themeSettings?.miniCartEnabled !== false;
  
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const [miniCartOpen, setMiniCartOpen] = React.useState(false);
  
  const viewportOverride = context?.viewport;
  const isMobileView = viewportOverride === 'mobile';
  
  const contextProduct = context?.product;
  
  const { data: exampleProduct, isLoading } = useQuery({
    queryKey: ['example-product-details', exampleProductId],
    queryFn: async () => {
      if (!exampleProductId || exampleProductId === '_auto') {
        const { data, error } = await supabase
          .from('products')
          .select(`id, name, price, compare_at_price, description, short_description, stock_quantity, status, allow_backorder, sku, product_images (id, url, alt_text, is_primary, sort_order)`)
          .eq('status', 'active')
          .limit(1)
          .single();
        if (error) return null;
        return data;
      }
      
      const { data, error } = await supabase
        .from('products')
        .select(`id, name, price, compare_at_price, description, short_description, stock_quantity, status, allow_backorder, sku, product_images (id, url, alt_text, is_primary, sort_order)`)
        .eq('id', exampleProductId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: isEditing || !contextProduct,
  });
  
  const product = contextProduct || exampleProduct;
  
  const allImages = React.useMemo(() => {
    if (contextProduct?.images?.length) {
      const imgs = [...contextProduct.images];
      return imgs.sort((a: any, b: any) => {
        if (a.is_primary) return -1;
        if (b.is_primary) return 1;
        return 0;
      });
    } else if (product?.product_images?.length) {
      return [...product.product_images].sort((a: any, b: any) => {
        if (a.is_primary) return -1;
        if (b.is_primary) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      }).map((img: any) => ({
        url: img.url,
        alt: img.alt_text,
        is_primary: img.is_primary,
      }));
    }
    return [];
  }, [contextProduct?.images, product?.product_images]);
  
  React.useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);
  
  const selectedImage = allImages[selectedImageIndex] || allImages[0];
  const hasMultipleImages = allImages.length > 1;

  // Use container query classes for responsive layout
  // sf-product-layout responds to storefront container width
  const gridClasses = 'sf-product-layout';
  
  const titleClasses = 'text-2xl md:text-3xl';
  const priceClasses = 'text-xl md:text-2xl';

  if (isLoading && isEditing) {
    return (
      <div className="py-6 md:py-8 px-4">
        <div className={gridClasses}>
          <div className="w-full">
            <div className="aspect-square bg-muted rounded-lg animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-6 bg-muted rounded w-1/4" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  // In public storefront, if product failed to load, show error state
  if (!product && !isEditing) {
    return (
      <div className="py-6 md:py-8 px-4">
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <svg className="w-16 h-16 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium mb-2">Produto não encontrado</h2>
          <p className="text-muted-foreground text-sm">O produto solicitado não está disponível no momento.</p>
        </div>
      </div>
    );
  }

  if (!product && isEditing) {
    // Placeholder completo conforme REGRAS.md - exemplifica estrutura da página
    return (
      <div className="py-6 md:py-8 px-4">
        <div className={gridClasses}>
          {/* Coluna esquerda: Galeria */}
          <div className="w-full">
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
              [Imagem do Produto]
            </div>
            {showGallery && (
              <div className="flex gap-2 mt-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-16 h-16 bg-muted/70 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                    {i}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Coluna direita: Info */}
          <div className="space-y-4">
            {/* Selos (sem desconto - descontos são geridos pelo menu Descontos) */}
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">Novo</span>
            </div>
            
            {/* Estrelas */}
            {showReviews && (
              <div className="flex items-center gap-1 text-yellow-500">
                {[1,2,3,4,5].map(i => <span key={i}>★</span>)}
                <span className="text-xs text-muted-foreground ml-1">(0)</span>
              </div>
            )}
            
            {/* Nome */}
            <h1 className={`${titleClasses} font-bold`}>[Nome do Produto]</h1>
            
            {/* Preço */}
            <div className="flex items-center gap-2">
              <p className={`${priceClasses} text-primary font-bold`}>R$ 99,90</p>
              <p className="text-muted-foreground line-through text-sm">R$ 129,90</p>
            </div>
            
            {/* Bandeirinhas pagamento */}
            <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-bold text-green-700">R$ 89,91 no Pix</p>
              <p className="text-xs text-green-600">10% de desconto</p>
            </div>
            
            {/* Descrição curta */}
            {showDescription && (
              <p className="text-muted-foreground text-sm">[Descrição curta do produto...]</p>
            )}
            
            {/* Variantes */}
            {showVariants && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Cor</p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 border rounded-md text-sm">Azul</span>
                  <span className="px-3 py-1 border rounded-md text-sm">Vermelho</span>
                </div>
              </div>
            )}
            
            {/* Estoque */}
            {showStock && (
              <p className="text-sm text-muted-foreground">Estoque: 10 unidades</p>
            )}
            
            {/* CTAs */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex items-center border rounded-full px-3">
                  <span className="text-sm">1</span>
                </div>
                <button className="flex-1 bg-primary text-primary-foreground py-2 rounded-full text-sm font-medium">
                  {buyNowButtonText}
                </button>
              </div>
              {showAddToCartButton && (
                <button className="w-full border-2 border-primary text-primary py-2 rounded-full text-sm font-medium">
                  Adicionar ao carrinho
                </button>
              )}
              {showWhatsAppButton && (
                <button className="w-full border-2 border-green-500 text-green-600 py-2 rounded-full text-sm font-medium">
                  Comprar pelo WhatsApp
                </button>
              )}
            </div>
            
            {/* Calculadora frete */}
            <div className="border rounded-lg p-3">
              <p className="text-sm font-medium mb-2">Calcular frete</p>
              <div className="flex gap-2">
                <input type="text" placeholder="00000-000" className="flex-1 border rounded px-2 py-1 text-sm" disabled />
                <button className="px-3 py-1 bg-muted text-sm rounded">Calcular</button>
              </div>
            </div>
            
            {/* Bandeirinhas garantia */}
            <div className="grid grid-cols-3 gap-2">
              {['Garantia', 'Troca', 'Seguro'].map(item => (
                <div key={item} className="text-center p-2 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Seções abaixo - Placeholders de referência visual (ordem conforme REGRAS.md) */}
        <div className="mt-8 space-y-4">
          {showBuyTogether && (
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
              <span className="text-muted-foreground text-sm font-medium">[Compre Junto]</span>
            </div>
          )}
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
            <span className="text-muted-foreground text-sm font-medium">[Descrição Completa]</span>
          </div>
          {showReviews && (
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
              <span className="text-muted-foreground text-sm font-medium">[Avaliações]</span>
            </div>
          )}
          {showRelatedProducts && (
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
              <span className="text-muted-foreground text-sm font-medium">[Produtos Relacionados]</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const productName = product?.name || 'Produto';
  const productPrice = product?.price || 0;
  const productCompareAtPrice = product?.compare_at_price || null;
  const productShortDescription = product?.short_description || 
    (product?.description ? product.description.substring(0, 200) + (product.description.length > 200 ? '...' : '') : '');
  const productStock = product?.stock_quantity ?? 0;
  const allowBackorder = product?.allow_backorder ?? false;
  
  const hasDiscount = productCompareAtPrice && productCompareAtPrice > productPrice;
  const discountPercent = hasDiscount 
    ? Math.round((1 - productPrice / productCompareAtPrice) * 100) 
    : 0;

  const tenantSlug = context?.tenantSlug || '';

  // Hook para variantes - SEMPRE chamado para evitar erro #310 (hooks condicionais)
  // O hook retorna dados vazios se productId for undefined
  const { optionGroups, selectedOptions, selectOption, selectedVariant, hasVariants } = useProductVariants(
    product?.id
  );
  
  // Regra de segurança: variante obrigatória
  const hasRequiredVariant = hasVariants && optionGroups.length > 0;
  const variantSelected = !hasRequiredVariant || Object.keys(selectedOptions).length === optionGroups.length;

  return (
    <div className="py-6 md:py-8 px-4">
      <div className={gridClasses}>
        {/* ===== COLUNA ESQUERDA: GALERIA ===== */}
        <div className="sf-product-gallery w-full">
          {/* Imagem principal (nunca some) */}
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            {selectedImage?.url ? (
              <img src={selectedImage.url} alt={selectedImage.alt || productName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Galeria secundária (até 10 imagens) - toggle showGallery */}
          {showGallery && hasMultipleImages && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {allImages.slice(0, 10).map((img: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={cn(
                    "flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all",
                    index === selectedImageIndex 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                >
                  <img src={img.url} alt={img.alt || `${productName} ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* ===== COLUNA DIREITA: INFO DO PRODUTO ===== */}
        <div className="sf-product-info space-y-4">
          {/* 1. Selos do produto (sem desconto - descontos são geridos pelo menu Descontos) */}
          <ProductBadges />
          
          {/* 2. Estrelas de avaliação */}
          {showReviews && product?.id && (
            <ProductRatingSummary productId={product.id} variant="productTitle" />
          )}
          
          {/* 3. Nome do produto */}
          <h1 className={`${titleClasses} font-bold leading-tight`}>{productName}</h1>
          
          {/* 4. Valores/preços */}
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${priceClasses} text-primary font-bold`}>
              R$ {productPrice.toFixed(2).replace('.', ',')}
            </p>
            {hasDiscount && discountPercent >= 1 && (
              <>
                <p className="text-muted-foreground line-through text-base md:text-lg">
                  R$ {productCompareAtPrice.toFixed(2).replace('.', ',')}
                </p>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                  -{discountPercent}%
                </span>
              </>
            )}
          </div>
          
          {/* 5. Bandeirinhas de pagamento (Pix destaque) */}
          <PaymentBadges productPrice={productPrice} />
          
          {/* 6. Descrição curta */}
          {showDescription && productShortDescription && (
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">{productShortDescription}</p>
          )}
          
          {/* 7. Seletor de variantes */}
          {showVariants && hasVariants && (
            <ProductVariantSelector
              optionGroups={optionGroups}
              selectedOptions={selectedOptions}
              onSelectOption={selectOption}
              disabled={isEditing && !isInteractMode}
            />
          )}
          
          {/* 8. Estoque */}
          {showStock && (
            <p className="text-sm text-muted-foreground">Estoque: {productStock} unidades</p>
          )}
          
          {/* 9-12. CTAs: Quantidade + Comprar agora + Adicionar + WhatsApp */}
          <ProductCTAs
            productId={product?.id}
            productName={productName}
            productSku={product?.sku || ''}
            productPrice={selectedVariant?.price ?? productPrice}
            productStock={selectedVariant?.stock_quantity ?? productStock}
            allowBackorder={allowBackorder}
            imageUrl={selectedImage?.url}
            tenantSlug={tenantSlug}
            isPreview={context?.isPreview}
            isEditing={isEditing}
            isInteractMode={isInteractMode}
            openMiniCartOnAdd={openMiniCartOnAdd}
            onOpenMiniCart={() => setMiniCartOpen(true)}
            showWhatsAppButton={showWhatsAppButton}
            showAddToCartButton={showAddToCartButton}
            buyNowButtonText={buyNowButtonText}
            miniCartEnabled={miniCartEnabled}
            hasRequiredVariant={hasRequiredVariant}
            variantSelected={variantSelected}
          />
          
          {/* 13. Calculadora de frete */}
          <ShippingCalculator 
            productId={product?.id}
            isEditing={isEditing && !isInteractMode}
          />
          
          {/* 14. Bandeirinhas de garantia */}
          <GuaranteeBadges />
        </div>
      </div>

      {/* ===== SEÇÕES ABAIXO ===== */}
      {/* Ordem conforme REGRAS.md: Compre Junto → Descrição completa → Avaliações → Relacionados */}
      {product && (
        <ProductPageSections
          product={{
            id: product.id,
            name: productName,
            price: productPrice,
            compare_at_price: productCompareAtPrice || undefined,
            sku: product.sku,
            description: product.description,
            images: allImages,
          }}
          tenantSlug={tenantSlug}
          tenantId={context?.settings?.tenant_id}
          showDescription={true} // Descrição completa sempre mostra (conforme regra)
          showBuyTogether={showBuyTogether}
          showReviews={showReviews}
          showRelatedProducts={showRelatedProducts}
          viewportOverride={viewportOverride}
        />
      )}

      {/* Mini Cart Drawer */}
      <MiniCartDrawer
        open={miniCartOpen}
        onOpenChange={setMiniCartOpen}
        tenantSlug={tenantSlug}
        isPreview={context?.isPreview}
      />
      
      {/* Floating Cart Button (Carrinho rápido) */}
      {showFloatingCart && (
        <FloatingCartButton tenantSlug={tenantSlug} isPreview={context?.isPreview} />
      )}
    </div>
  );
}

// ========== CART / CHECKOUT BLOCKS ==========

function CartSummaryBlock({ isEditing, context }: any) {
  const tenantId = context?.settings?.tenant_id || '';

  if (isEditing) {
    return (
      <div className="py-8">
        <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Componente de carrinho completo será renderizado aqui]
        </div>
      </div>
    );
  }

  return <CartContent tenantId={tenantId} />;
}

function CheckoutStepsBlock({ isEditing, context }: any) {
  const tenantId = context?.settings?.tenant_id || '';
  const steps = ['Identificação', 'Entrega', 'Pagamento', 'Confirmação'];

  if (isEditing) {
    return (
      <div className="py-8">
        <div className="flex justify-center mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              <span className="ml-2 text-sm hidden sm:inline">{step}</span>
              {i < steps.length - 1 && <div className="w-8 md:w-16 h-px bg-muted mx-2" />}
            </div>
          ))}
        </div>
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Formulário de checkout completo será renderizado aqui]
        </div>
      </div>
    );
  }

  return <CheckoutStepWizard tenantId={tenantId} />;
}

function CartBlock({ isEditing, context, showCrossSell, showCouponField, showTrustBadges }: any) {
  const tenantId = context?.settings?.tenant_id || '';
  
  // Read cart settings from context (passed by VisualBuilder)
  // REGRAS.md: Settings come from context, not internal queries
  const cartSettings = context?.cartSettings;
  
  // Merge page settings with block props - page settings take precedence
  const effectiveShowCrossSell = cartSettings?.showCrossSell ?? showCrossSell ?? true;
  const effectiveShowCoupon = cartSettings?.couponEnabled ?? showCouponField ?? true;
  const effectiveShowShipping = cartSettings?.shippingCalculatorEnabled ?? true;
  const effectiveShowTrustBadges = cartSettings?.showTrustBadges ?? showTrustBadges ?? true;
  const effectiveShowBenefitBar = cartSettings?.showBenefitBar ?? true;
  const effectiveShowPromoBanner = cartSettings?.showPromoBanner ?? true;

  if (isEditing) {
    return (
      <CartDemoBlock 
        showCrossSell={effectiveShowCrossSell} 
        showCouponField={effectiveShowCoupon}
        showShippingCalculator={effectiveShowShipping}
        showTrustBadges={effectiveShowTrustBadges}
        isEditing 
      />
    );
  }

  return <CartContent tenantId={tenantId} />;
}

function CheckoutBlock({ isEditing, context, showOrderBump, showTimeline }: any) {
  const tenantId = context?.settings?.tenant_id || '';
  
  // Read checkout settings from context (passed by VisualBuilder)
  // REGRAS.md: Settings come from context, not internal queries
  const checkoutSettings = context?.checkoutSettings;
  
  // Merge page settings with block props - page settings take precedence
  const effectiveShowOrderBump = checkoutSettings?.showOrderBump ?? showOrderBump ?? true;
  const effectiveShowTimeline = checkoutSettings?.showTimeline ?? showTimeline ?? true;
  const effectiveShowCoupon = checkoutSettings?.couponEnabled ?? true;
  const effectiveShowTestimonials = checkoutSettings?.testimonialsEnabled ?? true;
  const effectiveShowTrustBadges = checkoutSettings?.showTrustBadges ?? true;
  const effectiveShowSecuritySeals = checkoutSettings?.showSecuritySeals ?? true;

  if (isEditing) {
    return (
      <CheckoutDemoBlock 
        showOrderBump={effectiveShowOrderBump} 
        showTimeline={effectiveShowTimeline}
        showCouponField={effectiveShowCoupon}
        showTestimonials={effectiveShowTestimonials}
        showTrustBadges={effectiveShowTrustBadges}
        isEditing 
      />
    );
  }

  return <CheckoutStepWizard tenantId={tenantId} />;
}

function ThankYouBlock({ isEditing, context, showTimeline = true, showWhatsApp = true }: any) {
  const tenantSlug = context?.tenantSlug || '';
  const isPreview = context?.isPreview || false;
  
  // Read thank you settings from context (passed by VisualBuilder)
  // REGRAS.md: Settings come from context, not internal queries
  const thankYouSettings = context?.thankYouSettings;
  
  // Merge page settings with props - page settings take precedence
  const effectiveShowTimeline = thankYouSettings?.showTimeline ?? showTimeline ?? true;
  const effectiveShowUpsell = thankYouSettings?.showUpsell ?? true;
  const effectiveShowWhatsApp = thankYouSettings?.showWhatsApp ?? showWhatsApp ?? true;
  
  if (isEditing) {
    return (
      <div className="py-12 container mx-auto px-4 max-w-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Obrigado pela compra!</h1>
        <p className="text-muted-foreground mb-6">Seu pedido #XXXXX foi recebido com sucesso.</p>
        
        {effectiveShowTimeline && (
          <div className="border rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold mb-4">Próximos passos</h3>
            <div className="space-y-4">
              {['Pedido confirmado', 'Separação', 'Envio'].map((step, i) => (
                <div key={step} className="flex gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                    i === 0 ? "bg-green-100" : "bg-muted"
                  )}>
                    {i === 0 ? <Check className="h-3 w-3 text-green-600" /> : <span className="text-xs">{i + 1}</span>}
                  </div>
                  <p className="font-medium">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {effectiveShowUpsell && (
          <div className="border rounded-lg p-6 mb-6 bg-muted/50">
            <p className="text-sm text-muted-foreground">[Upsell - Ofertas pós-compra aparecerão aqui]</p>
          </div>
        )}
        
        {effectiveShowWhatsApp && (
          <Button variant="outline" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Falar com suporte via WhatsApp
          </Button>
        )}
      </div>
    );
  }
  
  return <ThankYouContent tenantSlug={tenantSlug} isPreview={isPreview} />;
}

// ========== ACCOUNT BLOCKS ==========

function AccountHubBlock({ context, isEditing }: any) {
  // NOTE: All hooks MUST be called before any conditional return
  const [searchParams] = useSearchParams();
  
  const tenantSlug = context?.tenantSlug || '';
  
  // Helper functions (not hooks - can be defined anywhere)
  const getWhatsAppHref = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };
  
  const getStoreBaseUrl = (slug: string) => slug ? `/loja/${slug}` : '';
  
  // Get settings from context
  const storeSettings = context?.settings || {};
  const isDemoMode = searchParams.has('demoAccount');
  const basePath = getStoreBaseUrl(tenantSlug);
  
  const whatsappNumber = storeSettings?.social_whatsapp || '+5511919555920';
  const whatsappHref = getWhatsAppHref(whatsappNumber, 'Olá! Preciso de suporte.');
  
  // CONDITIONAL RETURN - after all hooks have been called
  if (isEditing) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <span className="text-2xl">👤</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Minha Conta</h1>
          <p className="text-muted-foreground">Gerencie seus pedidos e informações</p>
        </div>
        <div className="grid gap-4">
          <div className="p-6 bg-card border rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">📦</div>
              <div>
                <p className="font-semibold">Meus Pedidos</p>
                <p className="text-sm text-muted-foreground">Acompanhe seus pedidos</p>
              </div>
            </div>
            <div className="h-10 bg-primary rounded w-full flex items-center justify-center text-primary-foreground text-sm">Ver pedidos</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <span className="text-2xl">👤</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Minha Conta</h1>
        <p className="text-muted-foreground">Gerencie seus pedidos e informações</p>
      </div>
      
      <div className="grid gap-4">
        <div className="p-6 bg-card border rounded-lg hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">📦</div>
            <div>
              <p className="font-semibold">Meus Pedidos</p>
              <p className="text-sm text-muted-foreground">Acompanhe seus pedidos</p>
            </div>
          </div>
          <Link to={`${basePath}/conta/pedidos${isDemoMode ? '?demoAccount=1' : ''}`}>
            <Button className="w-full">Ver pedidos</Button>
          </Link>
        </div>
        <div className="p-6 bg-card border rounded-lg hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-100">💬</div>
            <div>
              <p className="font-semibold">Suporte</p>
              <p className="text-sm text-muted-foreground">Fale pelo WhatsApp</p>
            </div>
          </div>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full">Falar no WhatsApp</Button>
          </a>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <Link to={basePath || '/'}>
          <Button variant="ghost">🛒 Voltar à loja</Button>
        </Link>
      </div>
    </div>
  );
}

function OrdersListBlock({ context, isEditing }: any) {
  // This block only renders a placeholder in the Builder.
  // In production, the actual StorefrontOrdersList page is used directly.
  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Meus Pedidos</h1>
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="p-4 bg-card border rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold">Pedido #100{i}</p>
                <p className="text-sm text-muted-foreground">15 de Dez de 2024</p>
              </div>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Em andamento</span>
            </div>
            <div className="h-9 px-4 border rounded flex items-center text-sm">Ver detalhes →</div>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          [Este bloco mostra a lista de pedidos do cliente na loja publicada]
        </p>
      )}
    </div>
  );
}

function OrderDetailBlock({ context, isEditing }: any) {
  // This block only renders a placeholder in the Builder.
  // In production, the actual StorefrontOrderDetail page is used directly.
  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <h1 className="text-2xl font-bold">Pedido #1001</h1>
      <p className="text-muted-foreground mb-6">15 de Dezembro de 2024</p>
      <div className="p-4 bg-card border rounded-lg">
        <p className="font-semibold mb-4">Acompanhamento</p>
        <div className="space-y-3">
          {['Pedido confirmado', 'Em separação'].map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs">✓</div>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
      {isEditing && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          [Este bloco mostra os detalhes do pedido na loja publicada]
        </p>
      )}
    </div>
  );
}

// ========== BLOCK WRAPPERS ==========

function HeroBannerBlockWrapper({ context, ...props }: any) {
  return <HeroBannerBlockComponent {...props} context={context} />;
}

function CollectionSectionBlockWrapper({ context, isEditing, ...props }: any) {
  return <CollectionSectionBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function InfoHighlightsBlockWrapper({ context, ...props }: any) {
  return <InfoHighlightsBlockComponent {...props} context={context} />;
}

function FeatureListBlockWrapper({ context, ...props }: any) {
  return <FeatureListBlockComponent {...props} context={context} />;
}

function ContentColumnsBlockWrapper({ context, ...props }: any) {
  return <ContentColumnsBlockComponent {...props} context={context} />;
}

function BannerProductsBlockWrapper({ context, isEditing, ...props }: any) {
  return <BannerProductsBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function YouTubeVideoBlockWrapper({ context, ...props }: any) {
  return <YouTubeVideoBlockComponent {...props} context={context} />;
}

function ReviewsBlockWrapper({ context, ...props }: any) {
  return <ReviewsBlockComponent {...props} context={context} />;
}

function FeaturedCategoriesBlockWrapper({ context, ...props }: any) {
  return <FeaturedCategoriesBlockComponent {...props} context={context} />;
}

function TextBannersBlockWrapper({ context, ...props }: any) {
  return <TextBannersBlockComponent {...props} context={context} />;
}

function VideoUploadBlockWrapper({ context, ...props }: any) {
  return <VideoUploadBlockComponent {...props} context={context} />;
}

function CategoryBannerBlockWrapper({ context, isEditing, ...props }: any) {
  return <CategoryBannerBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function VideoCarouselBlockWrapper({ context, ...props }: any) {
  return <VideoCarouselBlockComponent {...props} context={context} />;
}

function ImageCarouselBlockWrapper({ context, ...props }: any) {
  return <ImageCarouselBlockComponent {...props} context={context} />;
}

function TrackingLookupBlockWrapper({ context, isEditing, ...props }: any) {
  return <TrackingLookupBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function BlogListingBlockWrapper({ context, isEditing, ...props }: any) {
  return <BlogListingBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function BlogPostDetailBlockWrapper({ context, isEditing, ...props }: any) {
  return <BlogPostDetailBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function PageContentBlock({ context }: any) {
  return <PageContentBlockComponent context={context} />;
}

function CustomBlockWrapper({ customBlockId, htmlContent, cssContent, blockName, baseUrl, context, isEditing }: any) {
  return (
    <CustomBlockRendererComponent
      customBlockId={customBlockId}
      htmlContent={htmlContent}
      cssContent={cssContent}
      blockName={blockName}
      baseUrl={baseUrl}
      context={context}
      isEditing={isEditing}
    />
  );
}

function HTMLSectionWrapper({ htmlContent, htmlDesktop, htmlMobile, cssContent, blockName, baseUrl, isEditing, context }: any) {
  return (
    <CustomBlockRendererComponent
      htmlContent={htmlContent || htmlDesktop || htmlMobile || ''}
      cssContent={cssContent || ''}
      blockName={blockName || 'Seção HTML'}
      baseUrl={baseUrl}
      isEditing={isEditing}
      context={context}
    />
  );
}

function StepsTimelineBlockWrapper(props: any) {
  return <StepsTimelineBlockComponent {...props} />;
}

function CountdownTimerBlockWrapper(props: any) {
  return <CountdownTimerBlockComponent {...props} />;
}

function LogosCarouselBlockWrapper(props: any) {
  return <LogosCarouselBlockComponent {...props} />;
}

function StatsNumbersBlockWrapper(props: any) {
  return <StatsNumbersBlockComponent {...props} />;
}

function ImageGalleryBlockWrapper(props: any) {
  return <ImageGalleryBlockComponent {...props} />;
}

function AccordionBlockBlockWrapper(props: any) {
  return <AccordionBlockComponent {...props} />;
}

// CategoryPageLayout wrapper - sistema de listagem de categoria (REGRAS.md)
function CategoryPageLayoutBlock({ context, isEditing, ...props }: any) {
  return <CategoryPageLayoutComponent context={context} isEditing={isEditing} {...props} />;
}
