// =============================================
// BLOCK RENDERER - Renders blocks recursively
// =============================================

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { isEssentialBlock, getEssentialBlockReason } from '@/lib/builder/essentialBlocks';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AddBlockButton } from './AddBlockButton';
import { BlockQuickActions } from './BlockQuickActions';
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
import { getPublicMyOrdersUrl, getPublicPageUrl, getPublicProductUrl } from '@/lib/publicUrls';
import { StorefrontFooterContent } from '@/components/storefront/StorefrontFooterContent';
import { StorefrontHeaderContent } from '@/components/storefront/StorefrontHeaderContent';
import { ProductPageSections } from '@/components/storefront/ProductPageSections';
import { RatingSummary } from '@/components/storefront/RatingSummary';
import { useProductRating } from '@/hooks/useProductRating';

// Wrapper component that fetches and displays product rating
function ProductRatingSummary({ 
  productId, 
  variant = 'productTitle',
  className 
}: { 
  productId: string; 
  variant?: 'productTitle' | 'card';
  className?: string;
}) {
  const { data: rating } = useProductRating(productId);
  
  if (!rating || rating.count === 0) return null;
  
  return (
    <RatingSummary
      average={rating.average}
      count={rating.count}
      variant={variant}
      className={className}
    />
  );
}

interface BlockRendererProps {
  node: BlockNode;
  context: BlockRenderContext;
  isSelected?: boolean;
  isEditing?: boolean;
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
    // In storefront/preview public mode: render nothing (fail-silent)
    // In editor mode: show placeholder warning
    if (!isEditing) {
      return null;
    }
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500 rounded text-amber-700 dark:text-amber-400 text-sm">
        ⚠️ Bloco removido/legado: {node.type}
        <p className="text-xs mt-1 opacity-75">Este bloco não existe mais. Remova-o para evitar problemas.</p>
      </div>
    );
  }

  // Don't render hidden blocks in preview/public mode
  if (node.hidden && !isEditing) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing && onSelect) {
      e.stopPropagation();
      onSelect(node.id);
    }
  };

  // Render children with "+" buttons between them
  const renderChildren = () => {
    if (!node.children?.length) {
      // Empty container - show add button
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
            {/* Add block button before first child */}
            {index === 0 && isEditing && onAddBlock && definition.canHaveChildren && (
              <div className="py-1">
                <AddBlockButton
                  parentId={node.id}
                  index={0}
                  onAddBlock={onAddBlock}
                />
              </div>
            )}
            
            <BlockRenderer
              node={child}
              context={context}
              isEditing={isEditing}
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

            {/* Render afterHeaderSlot after Header block (e.g., category banner) */}
            {child.type === 'Header' && context.afterHeaderSlot && (
              <div className="w-full">
                {context.afterHeaderSlot}
              </div>
            )}
            
            {/* Add block button after each child */}
            {isEditing && onAddBlock && definition.canHaveChildren && (
              <div className="py-1">
                <AddBlockButton
                  parentId={node.id}
                  index={index + 1}
                  onAddBlock={onAddBlock}
                />
              </div>
            )}
          </div>
        ))}
      </>
    );
  };

  // Get component based on block type
  const BlockComponent = getBlockComponent(node.type);
  
  const canMoveUp = siblingIndex > 0;
  const canMoveDown = siblingIndex < siblingsCount - 1;
  const isRemovable = definition.isRemovable !== false;
  
  // Check if this block is essential for the current page type
  const pageType = context.pageType || 'home';
  const isEssential = isEssentialBlock(node.type, pageType);
  const essentialReason = isEssential ? getEssentialBlockReason(node.type, pageType) : undefined;

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
      {/* Selected block label */}
      {isSelected && isEditing && (
        <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-t z-10 flex items-center gap-1">
          {definition.label}
          {node.hidden && <span className="text-xs">(oculto)</span>}
        </div>
      )}
      
      {/* Quick Actions - only show when editing and not Page block */}
      {isEditing && node.type !== 'Page' && (
        <BlockQuickActions
          blockId={node.id}
          blockType={node.type}
          isRemovable={isRemovable}
          isEssential={isEssential}
          essentialReason={essentialReason || undefined}
          isHidden={node.hidden}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => onMoveBlock?.(node.id, 'up')}
          onMoveDown={() => onMoveBlock?.(node.id, 'down')}
          onDuplicate={() => onDuplicateBlock?.(node.id)}
          onDelete={() => onDeleteBlock?.(node.id)}
          onToggleHidden={() => onToggleHidden?.(node.id)}
        />
      )}
      
      <BlockComponent 
        {...node.props} 
        context={context}
        isEditing={isEditing}
        block={node}
      >
        {renderChildren()}
      </BlockComponent>
    </div>
  );
}

// Block component implementations
function getBlockComponent(type: string): React.ComponentType<any> {
const components: Record<string, React.ComponentType<any>> = {
    Page: PageBlock,
    Section: SectionBlock,
    Container: ContainerBlock,
    Grid: GridBlock,
    Column: ColumnBlock,
    Columns: ColumnsBlock,
    Header: HeaderBlock,
    Footer: FooterBlock,
    Hero: HeroBlock,
    Text: TextBlock,
    RichText: RichTextBlock,
    Image: ImageBlock,
    Button: ButtonBlock,
    Spacer: SpacerBlock,
    Divider: DividerBlock,
    FAQ: FAQBlock,
    Testimonials: TestimonialsBlock,
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
    // Essential blocks (8 novos)
    HeroBanner: HeroBannerBlockWrapper,
    CollectionSection: CollectionSectionBlockWrapper,
    InfoHighlights: InfoHighlightsBlockWrapper,
    BannerProducts: BannerProductsBlockWrapper,
    YouTubeVideo: YouTubeVideoBlockWrapper,
    Reviews: ReviewsBlockWrapper,
    FeaturedCategories: FeaturedCategoriesBlockWrapper,
    TextBanners: TextBannersBlockWrapper,
    VideoUpload: VideoUploadBlockWrapper,
  };

  return components[type] || FallbackBlock;
}

// Fallback for unknown blocks
function FallbackBlock({ children }: { children?: React.ReactNode }) {
  return <div className="p-4 bg-muted rounded">{children}</div>;
}

// ========== LAYOUT BLOCKS ==========

/**
 * PageBlock - Root container for page content
 * 
 * IMPORTANT: This block renders children directly without manipulation.
 * DO NOT insert content by children index here.
 * 
 * For injecting content at specific positions (e.g., after header, before footer),
 * use slots (afterHeaderSlot, afterContentSlot) passed via BlockRenderContext
 * and rendered in PublicTemplateRenderer.tsx.
 */
function PageBlock({ children, backgroundColor }: any) {
  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor }}
    >
      {children}
    </div>
  );
}


function SectionBlock({ 
  children, 
  backgroundColor, 
  paddingX = 16, 
  paddingY = 32, 
  marginTop = 0,
  marginBottom = 0,
  gap = 16,
  alignItems = 'stretch',
  fullWidth 
}: any) {
  return (
    <section 
      className={cn(
        'flex flex-col',
        fullWidth ? 'w-full' : 'container mx-auto',
      )}
      style={{ 
        backgroundColor: backgroundColor || 'transparent',
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`,
        gap: `${gap}px`,
        alignItems: alignItems,
      }}
    >
      {children}
    </section>
  );
}

function ContainerBlock({ 
  children, 
  maxWidth = '1200',
  padding = 16,
  marginTop = 0,
  marginBottom = 0,
  gap = 16,
}: any) {
  const maxWidthMap: Record<string, string> = {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    'full': '100%',
  };

  return (
    <div 
      className="mx-auto flex flex-col"
      style={{ 
        maxWidth: maxWidthMap[maxWidth] || `${maxWidth}px`,
        padding: `${padding}px`,
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}

function GridBlock({ children, columns, gap }: any) {
  return (
    <div 
      className="grid"
      style={{ 
        gridTemplateColumns: `repeat(${columns || 2}, minmax(0, 1fr))`,
        gap: `${gap || 16}px`
      }}
    >
      {children}
    </div>
  );
}

function ColumnBlock({ children, span }: any) {
  return (
    <div style={{ gridColumn: `span ${span || 1}` }}>
      {children}
    </div>
  );
}

function ColumnsBlock({ 
  children, 
  columns = 2, 
  gap = 16,
  stackOnMobile = true,
  alignItems = 'stretch',
}: any) {
  return (
    <div 
      className={cn(
        'grid',
        stackOnMobile && 'grid-cols-1 md:grid-cols-[var(--cols)]'
      )}
      style={{ 
        '--cols': `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateColumns: stackOnMobile ? undefined : `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        alignItems: alignItems,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// ========== HEADER / FOOTER ==========

function HeaderBlock({
  context, 
  isEditing,
  block
}: any) {
  const { settings, headerMenu, categories, tenantSlug } = context || {};
  
  // Fetch pages for menu item URL resolution
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
  
  // Create a headerConfig object with the block's props
  const headerConfig = {
    ...block,
    props: block?.props || {},
  };
  
  // Map context settings to expected format
  const storeSettings = settings ? {
    logo_url: settings.logo_url,
    store_name: settings.store_name,
    primary_color: settings.primary_color,
    social_whatsapp: settings.social_whatsapp,
    contact_phone: settings.contact_phone,
    contact_email: settings.contact_email,
    social_facebook: settings.social_facebook,
    social_instagram: settings.social_instagram,
  } : null;
  
  // headerMenu comes as array directly from context (not { items: [...] })
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

function FooterBlock({ 
  context, 
  isEditing,
  block
}: any) {
  // FooterBlock now renders the unified StorefrontFooterContent
  // Create a footerConfig object with the block's props directly accessible
  // This ensures the toggle props (showLogo, showSac, etc.) are read correctly
  const footerConfig = {
    ...block,
    props: block?.props || {},
  };
  
  return (
    <StorefrontFooterContent 
      tenantSlug={context?.tenantSlug || ''} 
      footerConfig={footerConfig}
      isEditing={isEditing} 
    />
  );
}

// ========== CONTENT BLOCKS ==========

function HeroBlock({ 
  title, 
  subtitle, 
  buttonText, 
  buttonUrl, 
  imageDesktop,
  imageMobile,
  backgroundImage, // Legacy prop support
  backgroundColor, 
  textColor, 
  buttonColor, 
  buttonTextColor,
  buttonHoverBgColor,
  buttonHoverTextColor,
  height = 'md', 
  alignment = 'center', 
  overlayOpacity = 50,
  context,
}: any) {
  const alignClass = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[alignment] || 'items-center text-center';

  const heightMap: Record<string, string> = {
    sm: '300px',
    md: '400px',
    lg: '500px',
    full: '100vh',
  };

  // Generate unique ID for CSS custom properties
  const btnId = `hero-btn-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate hover colors if not provided (darken base color)
  const baseBgColor = buttonColor || '#ffffff';
  const baseTextColor = buttonTextColor || (buttonColor ? '#ffffff' : (backgroundColor || '#6366f1'));
  const hoverBg = buttonHoverBgColor || baseBgColor;
  const hoverText = buttonHoverTextColor || baseTextColor;

  // Use actual images for responsive display
  const desktopImage = imageDesktop || backgroundImage;
  const mobileImage = imageMobile || desktopImage;
  
  // Builder mode: use context.viewport state; Storefront: use <picture>
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = context?.viewport === 'mobile';

  return (
    <div 
      className="relative flex items-center justify-center overflow-hidden"
      style={{ 
        backgroundColor: desktopImage ? undefined : (backgroundColor || 'hsl(var(--primary))'),
        minHeight: heightMap[height] || '400px',
      }}
    >
      {/* Background Image */}
      {desktopImage && (
        isBuilderMode ? (
          // Builder mode: select image based on viewport state
          <img 
            src={isMobile && mobileImage ? mobileImage : desktopImage}
            alt="" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // Storefront mode: use <picture> for real responsive
          <picture className="absolute inset-0 w-full h-full">
            {mobileImage && mobileImage !== desktopImage && (
              <source media="(max-width: 767px)" srcSet={mobileImage} />
            )}
            <img 
              src={desktopImage} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </picture>
        )
      )}
      {desktopImage && (
        <div 
          className="absolute inset-0 bg-black" 
          style={{ opacity: overlayOpacity / 100 }} 
        />
      )}
      <div className={cn("relative z-10 px-4 py-12 flex flex-col max-w-4xl mx-auto", alignClass)}>
        <h1 
          className="text-4xl md:text-5xl font-bold mb-4"
          style={{ color: textColor || '#ffffff' }}
        >
          {title || 'Título Principal'}
        </h1>
        {subtitle && (
          <p 
            className="text-xl mb-8 opacity-90"
            style={{ color: textColor || '#ffffff' }}
          >
            {subtitle}
          </p>
        )}
        {buttonText && (
          <>
            <style>{`
              .${btnId} {
                background-color: ${baseBgColor};
                color: ${baseTextColor};
              }
              .${btnId}:hover {
                background-color: ${hoverBg};
                color: ${hoverText};
              }
            `}</style>
            <a 
              href={buttonUrl || '#'} 
              className={`${btnId} inline-block px-8 py-3 rounded-lg font-semibold transition-colors`}
            >
              {buttonText}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function TextBlock({ content, align, fontSize, fontWeight, color }: any) {
  return (
    <div 
      className="prose max-w-none"
      style={{ 
        textAlign: align || 'left',
        fontSize: fontSize || '16px',
        fontWeight: fontWeight || 'normal',
        color: color || 'inherit',
      }}
      dangerouslySetInnerHTML={{ __html: content || '<p>Texto de exemplo</p>' }}
    />
  );
}

function RichTextBlock({ content, align, fontFamily, fontSize, fontWeight, context }: any) {
  // Font size map
  const fontSizeMap: Record<string, string> = {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
  };

  // Replace template placeholders with context data
  const replacePlaceholders = (text: string): string => {
    if (!text) return '';
    
    let result = text;
    
    // Replace category placeholders
    if (context?.category) {
      result = result.replace(/\{\{category\.name\}\}/g, context.category.name || '');
      result = result.replace(/\{\{category\.description\}\}/g, context.category.description || '');
      result = result.replace(/\{\{category\.id\}\}/g, context.category.id || '');
    }
    
    // Replace product placeholders
    if (context?.product) {
      result = result.replace(/\{\{product\.name\}\}/g, context.product.name || '');
      result = result.replace(/\{\{product\.description\}\}/g, context.product.description || '');
      result = result.replace(/\{\{product\.price\}\}/g, context.product.price?.toString() || '');
    }
    
    // Replace store placeholders
    if (context?.settings) {
      result = result.replace(/\{\{store\.name\}\}/g, context.settings.store_name || '');
    }
    
    return result;
  };
  
  // Convert markdown-like content to HTML
  const processContent = (text: string): string => {
    if (!text) return '<p>Conteúdo de texto formatado...</p>';
    
    // First replace placeholders
    let processed = replacePlaceholders(text);
    
    // If already HTML, return as is
    if (processed.includes('<')) return processed;
    
    // Simple markdown conversion
    let html = processed
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-primary underline">$1</a>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br />');

    return html;
  };

  return (
    <div 
      className="prose prose-lg max-w-none"
      style={{ 
        textAlign: align || 'left',
        fontFamily: fontFamily || 'inherit',
        fontSize: fontSizeMap[fontSize] || fontSizeMap.base,
        fontWeight: fontWeight || 'normal',
      }}
      dangerouslySetInnerHTML={{ __html: processContent(content) }}
    />
  );
}

function ImageBlock({ 
  imageDesktop,
  imageMobile,
  src, // Legacy support
  alt, 
  width, 
  height, 
  objectFit = 'cover',
  objectPosition = 'center',
  aspectRatio = 'auto',
  rounded = 'none',
  shadow = 'none',
  linkUrl,
  context,
}: any) {
  const widthMap: Record<string, string> = {
    '25': '25%',
    '50': '50%',
    '75': '75%',
    'full': '100%',
  };

  const roundedMap: Record<string, string> = {
    'none': '0',
    'sm': '0.25rem',
    'md': '0.5rem',
    'lg': '1rem',
    'full': '9999px',
  };

  const shadowMap: Record<string, string> = {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  };

  const aspectRatioMap: Record<string, string> = {
    'auto': 'auto',
    '1:1': '1 / 1',
    '4:3': '4 / 3',
    '16:9': '16 / 9',
    '21:9': '21 / 9',
  };

  // Use actual images (with legacy fallback)
  const desktopImage = imageDesktop || src;
  const mobileImage = imageMobile || desktopImage;
  
  // Builder mode: use context.viewport state; Storefront: use <picture>
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = context?.viewport === 'mobile';

  const imageContent = (
    <div 
      className="overflow-hidden" 
      style={{ 
        width: widthMap[width] || '100%',
        borderRadius: roundedMap[rounded] || '0',
        boxShadow: shadowMap[shadow] || 'none',
      }}
    >
      {desktopImage ? (
        isBuilderMode ? (
          // Builder mode: select image based on viewport state
          <img 
            src={isMobile && mobileImage ? mobileImage : desktopImage} 
            alt={alt || 'Imagem'} 
            style={{ 
              width: '100%',
              height: height === 'auto' ? 'auto' : (height || 'auto'),
              objectFit: objectFit || 'cover',
              objectPosition: objectPosition || 'center',
              aspectRatio: aspectRatioMap[aspectRatio] || 'auto',
              borderRadius: roundedMap[rounded] || '0',
            }}
          />
        ) : (
          // Storefront mode: use <picture> for real responsive
          <picture>
            {mobileImage && mobileImage !== desktopImage && (
              <source media="(max-width: 767px)" srcSet={mobileImage} />
            )}
            <img 
              src={desktopImage} 
              alt={alt || 'Imagem'} 
              style={{ 
                width: '100%',
                height: height === 'auto' ? 'auto' : (height || 'auto'),
                objectFit: objectFit || 'cover',
                objectPosition: objectPosition || 'center',
                aspectRatio: aspectRatioMap[aspectRatio] || 'auto',
                borderRadius: roundedMap[rounded] || '0',
              }}
            />
          </picture>
        )
      ) : (
        <div 
          className="bg-muted h-48 flex items-center justify-center text-muted-foreground"
          style={{ borderRadius: roundedMap[rounded] || '0' }}
        >
          Imagem
        </div>
      )}
    </div>
  );

  if (linkUrl) {
    return <a href={linkUrl}>{imageContent}</a>;
  }

  return imageContent;
}

function ButtonBlock({ 
  text, 
  url, 
  variant, 
  size, 
  alignment = 'left',
  fontFamily,
  fontWeight = 'semibold',
  backgroundColor, 
  textColor, 
  borderRadius = 'md',
  hoverBgColor,
  hoverTextColor,
  borderColor,
  hoverBorderColor,
}: any) {
  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  const radiusMap: Record<string, string> = {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  };

  const fontWeightMap: Record<string, string> = {
    normal: '400',
    '500': '500',
    semibold: '600',
    bold: '700',
  };

  const alignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[alignment] || 'justify-start';

  // Generate unique ID for CSS custom properties
  const btnId = `btn-${Math.random().toString(36).substr(2, 9)}`;

  // Determine colors based on variant or custom
  const hasCustomStyles = backgroundColor || textColor;
  
  // Default variant colors
  const variantColors: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: 'hsl(var(--primary))', text: 'hsl(var(--primary-foreground))' },
    secondary: { bg: 'hsl(var(--secondary))', text: 'hsl(var(--secondary-foreground))' },
    outline: { bg: 'transparent', text: 'hsl(var(--primary))', border: 'hsl(var(--primary))' },
    ghost: { bg: 'transparent', text: 'hsl(var(--primary))' },
  };
  
  const variantStyle = variantColors[variant] || variantColors.primary;
  const baseBg = backgroundColor || variantStyle.bg;
  const baseText = textColor || variantStyle.text;
  const baseBorder = borderColor || variantStyle.border || 'transparent';
  const hoverBg = hoverBgColor || (hasCustomStyles ? baseBg : undefined);
  const hoverText = hoverTextColor || (hasCustomStyles ? baseText : undefined);
  const hoverBorder = hoverBorderColor || baseBorder;

  return (
    <div className={cn('flex', alignmentClass)}>
      <style>{`
        .${btnId} {
          background-color: ${baseBg};
          color: ${baseText};
          border: 1px solid ${baseBorder};
        }
        .${btnId}:hover {
          ${hoverBg ? `background-color: ${hoverBg};` : 'opacity: 0.9;'}
          ${hoverText ? `color: ${hoverText};` : ''}
          ${hoverBorder ? `border-color: ${hoverBorder};` : ''}
        }
      `}</style>
      <a 
        href={url || '#'}
        className={cn(
          btnId,
          'inline-block transition-colors',
          sizeClasses[size] || sizeClasses.md
        )}
        style={{
          borderRadius: radiusMap[borderRadius] || '0.5rem',
          fontFamily: fontFamily || 'inherit',
          fontWeight: fontWeightMap[fontWeight] || '600',
        }}
      >
        {text || 'Botão'}
      </a>
    </div>
  );
}

function SpacerBlock({ height }: any) {
  const heightMap: Record<string, number> = {
    xs: 8,
    sm: 16,
    md: 32,
    lg: 48,
    xl: 64,
  };
  return <div style={{ height: `${heightMap[height] || height || 32}px` }} />;
}

function DividerBlock({ style, color, thickness }: any) {
  return (
    <hr 
      className="my-4"
      style={{ 
        borderColor: color || 'hsl(var(--border))',
        borderWidth: `${thickness || 1}px`,
        borderStyle: style || 'solid',
      }}
    />
  );
}

// ========== E-COMMERCE BLOCKS WITH REAL DATA ==========

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
        .select(`
          id, name, price, status,
          product_images (id, url, alt_text, is_primary, sort_order)
        `);
      
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

  if (!product && !isEditing) {
    return null;
  }

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
        <p className="text-xs text-muted-foreground mt-2 text-center">
          [Selecione um produto]
        </p>
      )}
    </div>
  );
}

function ProductDetailsBlock({ exampleProductId, showGallery = true, showDescription = true, showStock = true, context, isEditing }: any) {
  // Read settings from context (set by StorefrontProduct) or use defaults
  const productSettings = context?.productSettings || {};
  const showReviews = productSettings.showReviews !== false;
  const showBuyTogether = productSettings.showBuyTogether !== false;
  const showRelatedProducts = productSettings.showRelatedProducts !== false;
  
  // State for selected image in gallery
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  
  // Determine if mobile based on viewport context (Builder) or default to responsive CSS
  const viewportOverride = context?.viewport;
  const isMobileView = viewportOverride === 'mobile';
  const isTabletView = viewportOverride === 'tablet';
  const isDesktopView = viewportOverride === 'desktop' || !viewportOverride;
  
  // First check if we have product from context (public page)
  const contextProduct = context?.product;
  
  const { data: exampleProduct, isLoading } = useQuery({
    queryKey: ['example-product-details', exampleProductId],
    queryFn: async () => {
      if (!exampleProductId || exampleProductId === '_auto') {
        // Auto-select first active product
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, name, price, compare_at_price, description, short_description, stock_quantity, status, allow_backorder,
            product_images (id, url, alt_text, is_primary, sort_order)
          `)
          .eq('status', 'active')
          .limit(1)
          .single();
        if (error) return null;
        return data;
      }
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, price, compare_at_price, description, short_description, stock_quantity, status, allow_backorder,
          product_images (id, url, alt_text, is_primary, sort_order)
        `)
        .eq('id', exampleProductId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: isEditing || !contextProduct,
  });
  
  // Use context product if available (public page), otherwise use example product (editor)
  const product = contextProduct || exampleProduct;
  
  // Get all images sorted - primary first, then by sort_order
  // For context products, images come from context.product.images
  // For example products, images come from product_images relation
  const allImages: { url: string; alt?: string; is_primary?: boolean }[] = React.useMemo(() => {
    if (contextProduct?.images?.length) {
      // From public context - already has images array
      const imgs = [...contextProduct.images];
      return imgs.sort((a: any, b: any) => {
        if (a.is_primary) return -1;
        if (b.is_primary) return 1;
        return 0;
      });
    } else if (product?.product_images?.length) {
      // From database query
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
  
  // Reset selected index when product changes
  React.useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);
  
  const selectedImage = allImages[selectedImageIndex] || allImages[0];
  const hasMultipleImages = allImages.length > 1;

  // Responsive layout classes based on viewport
  const gridClasses = viewportOverride 
    ? (isMobileView ? 'flex flex-col gap-6' : 'grid grid-cols-2 gap-8')
    : 'flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8';
  
  const titleClasses = viewportOverride
    ? (isMobileView ? 'text-2xl' : 'text-3xl')
    : 'text-2xl md:text-3xl';
  
  const priceClasses = viewportOverride
    ? (isMobileView ? 'text-xl' : 'text-2xl')
    : 'text-xl md:text-2xl';

  if (isLoading && isEditing) {
    return (
      <div className="py-6 md:py-8 px-4">
        <div className={gridClasses}>
          <div className="w-full">
            <div className="aspect-square bg-muted rounded-lg animate-pulse" />
            <div className="flex gap-2 mt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-16 h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-6 bg-muted rounded w-1/4" />
            <div className="h-20 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product && isEditing) {
    return (
      <div className="py-6 md:py-8 px-4">
        <div className={gridClasses}>
          <div className="w-full">
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
              [Imagem do Produto]
            </div>
          </div>
          <div className="space-y-4">
            <h1 className={`${titleClasses} font-bold`}>[Nome do Produto]</h1>
            <p className={`${priceClasses} text-primary font-bold`}>[Preço]</p>
            <p className="text-muted-foreground text-sm md:text-base">[Descrição do produto será exibida aqui]</p>
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg text-base font-semibold">
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
        <p className="text-center text-xs md:text-sm text-muted-foreground mt-4">
          [Selecione um produto de exemplo para visualizar ou use o seletor no toolbar]
        </p>
      </div>
    );
  }

  const productName = product?.name || 'Produto';
  const productPrice = product?.price || 0;
  const productCompareAtPrice = product?.compare_at_price || null;
  // Use short_description in hero section; full description goes in afterContentSlot
  const productShortDescription = product?.short_description || 
    (product?.description ? product.description.substring(0, 200) + (product.description.length > 200 ? '...' : '') : '');
  const productStock = product?.stock_quantity ?? 0;
  const allowBackorder = product?.allow_backorder ?? false;
  
  // Calculate discount percentage
  const hasDiscount = productCompareAtPrice && productCompareAtPrice > productPrice;
  const discountPercent = hasDiscount 
    ? Math.round((1 - productPrice / productCompareAtPrice) * 100) 
    : 0;

  // Get tenant slug from context
  const tenantSlug = context?.tenantSlug || '';


  return (
    <div className="py-6 md:py-8 px-4">
      {/* Main Product Section */}
      <div className={gridClasses}>
        {/* Gallery Section */}
        {showGallery && (
          <div className="w-full">
            {/* Main Image */}
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              {selectedImage?.url ? (
                <img 
                  src={selectedImage.url} 
                  alt={selectedImage.alt || productName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {hasMultipleImages && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {allImages.map((img, index) => (
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
                    <img 
                      src={img.url} 
                      alt={img.alt || `${productName} ${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Product Info */}
        <div className="space-y-4">
          <div>
            <h1 className={`${titleClasses} font-bold leading-tight`}>{productName}</h1>
            {/* Rating Summary - below product name (only show if showReviews is enabled) */}
            {showReviews && product?.id && (
              <ProductRatingSummary 
                productId={product.id} 
                variant="productTitle"
                className="mt-2"
              />
            )}
          </div>
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
          {showDescription && productShortDescription && (
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">{productShortDescription}</p>
          )}
          {showStock && (
            <p className="text-sm text-muted-foreground">
              Estoque: {productStock} unidades
            </p>
          )}
          <button className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-semibold text-base hover:bg-primary/90 transition-colors">
            Adicionar ao Carrinho
          </button>
        </div>
      </div>

      {/* 
        Additional Sections - ALWAYS rendered (Editor AND Preview/Public)
        This ensures identical order in all contexts: Description → BuyTogether → Reviews → Related Products
      */}
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
          showDescription={showDescription}
          showBuyTogether={showBuyTogether}
          showReviews={showReviews}
          showRelatedProducts={showRelatedProducts}
          viewportOverride={viewportOverride}
        />
      )}
    </div>
  );
}

// ========== CART / CHECKOUT BLOCKS ==========

function CartSummaryBlock({ isEditing }: any) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {isEditing ? (
            <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
              [Itens do carrinho serão listados aqui]
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              Seu carrinho está vazio
            </div>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Resumo</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>R$ 0,00</span>
            </div>
            <div className="flex justify-between">
              <span>Frete</span>
              <span>A calcular</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>R$ 0,00</span>
            </div>
          </div>
          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg mt-4 font-semibold">
            Finalizar Compra
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutStepsBlock({ isEditing }: any) {
  const steps = ['Identificação', 'Entrega', 'Pagamento', 'Confirmação'];
  
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
            {i < steps.length - 1 && (
              <div className="w-8 md:w-16 h-px bg-muted mx-2" />
            )}
          </div>
        ))}
      </div>
      
      {isEditing ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Formulário de checkout será renderizado aqui]
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Dados do Cliente</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nome completo" className="w-full p-2 border rounded bg-background" />
                <input type="email" placeholder="E-mail" className="w-full p-2 border rounded bg-background" />
                <input type="tel" placeholder="Telefone" className="w-full p-2 border rounded bg-background" />
              </div>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Resumo do Pedido</h2>
            <div className="text-muted-foreground">
              Carrinho vazio
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartBlock({ isEditing }: any) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>
      {isEditing ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Componente de carrinho será renderizado aqui]
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Seu carrinho está vazio
        </div>
      )}
    </div>
  );
}

function CheckoutBlock({ isEditing }: any) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>
      {isEditing ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Formulário de checkout será renderizado aqui]
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Seu carrinho está vazio
        </div>
      )}
    </div>
  );
}

function FAQBlock({ title, items, isEditing, allowMultiple = false, titleAlign = 'left' }: any) {
  const faqItems = items || [
    { question: 'Pergunta de exemplo 1?', answer: 'Resposta de exemplo 1.' },
    { question: 'Pergunta de exemplo 2?', answer: 'Resposta de exemplo 2.' },
  ];

  const alignClass = titleAlign === 'center' ? 'text-center' : titleAlign === 'right' ? 'text-right' : 'text-left';

  return (
    <div className="py-8">
      {title && <h2 className={`text-2xl font-bold mb-6 ${alignClass}`}>{title}</h2>}
      <Accordion type={allowMultiple ? "multiple" : "single"} collapsible className="w-full space-y-2">
        {faqItems.map((item: any, i: number) => (
          <AccordionItem key={i} value={`item-${i}`} className="border rounded-lg px-4">
            <AccordionTrigger className="text-left font-semibold hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground pb-4">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {isEditing && faqItems.length === 0 && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure as perguntas no painel lateral]
        </p>
      )}
    </div>
  );
}

function TestimonialsBlock({ title, items, isEditing }: any) {
  const testimonials = items || [
    { name: 'Cliente 1', content: 'Ótima experiência de compra!', rating: 5 },
    { name: 'Cliente 2', content: 'Produtos de qualidade.', rating: 4 },
    { name: 'Cliente 3', content: 'Entrega rápida e embalagem perfeita.', rating: 5 },
  ];

  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((item: any, i: number) => (
          <div key={i} className="bg-card border rounded-lg p-6 text-center">
            <div className="mb-3">
              {'⭐'.repeat(item.rating || 5)}
            </div>
            <p className="text-muted-foreground mb-4 italic">"{item.content || item.text}"</p>
            <p className="font-semibold">{item.name}</p>
            {item.role && <p className="text-sm text-muted-foreground">{item.role}</p>}
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure os depoimentos no painel lateral]
        </p>
      )}
    </div>
  );
}

// ========== ESSENTIAL BLOCK WRAPPERS (8 novos) ==========

function HeroBannerBlockWrapper({ context, ...props }: any) {
  return <HeroBannerBlockComponent {...props} context={context} />;
}

function CollectionSectionBlockWrapper({ context, isEditing, ...props }: any) {
  return <CollectionSectionBlockComponent {...props} context={context} isEditing={isEditing} />;
}

function InfoHighlightsBlockWrapper({ context, ...props }: any) {
  return <InfoHighlightsBlockComponent {...props} context={context} />;
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
