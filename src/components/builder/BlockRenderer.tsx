// =============================================
// BLOCK RENDERER - Renders blocks recursively
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AddBlockButton } from './AddBlockButton';
import { BlockQuickActions } from './BlockQuickActions';
import { ProductGridBlock as ProductGridBlockComponent } from './blocks/ProductGridBlock';
import { CategoryListBlock as CategoryListBlockComponent } from './blocks/CategoryListBlock';

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
    return (
      <div className="p-4 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
        Bloco desconhecido: {node.type}
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
    Banner: BannerBlock,
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
  };

  return components[type] || FallbackBlock;
}

// Fallback for unknown blocks
function FallbackBlock({ children }: { children?: React.ReactNode }) {
  return <div className="p-4 bg-muted rounded">{children}</div>;
}

// ========== LAYOUT BLOCKS ==========

function PageBlock({ children, backgroundColor }: any) {
  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: backgroundColor || 'transparent' }}
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

import { useState, useEffect, useRef } from 'react';

function HeaderBlock({ 
  menuId, 
  showSearch = true, 
  showCart = true, 
  sticky, 
  // Header style props (Yampi)
  headerStyle = 'logo_left_menu_inline',
  headerBgColor = '',
  headerTextColor = '',
  headerIconColor = '',
  // Menu colors (for "menu below" styles)
  menuBgColor = '',
  menuTextColor = '',
  // Sticky mobile
  stickyOnMobile = true,
  // Contact in header
  showWhatsApp = false,
  whatsAppNumber = '',
  whatsAppLabel = '',
  showPhone = false,
  phoneNumber = '',
  phoneLabel = '',
  // Customer Area - only shows if enabled
  customerAreaEnabled = false,
  customerAreaLabel = 'Minhas compras',
  // Featured Promos
  featuredPromosEnabled = false,
  featuredPromosLabel = 'Promoções',
  featuredPromosTextColor = '#d97706',
  featuredPromosPageId = '',
  featuredPromosPageSlug = '', // Legacy support
  // Notice bar props
  noticeEnabled = false,
  noticeText = '',
  noticeBgColor = '#1e40af',
  noticeTextColor = '#ffffff',
  noticeAnimation = 'fade',
  // Notice action props
  noticeActionEnabled = false,
  noticeActionLabel = '',
  noticeActionUrl = '',
  noticeActionTarget = '_self',
  noticeActionTextColor = '',
  context, 
  isEditing 
}: any) {
  const { settings } = context || {};
  const noticeRef = useRef<HTMLDivElement>(null);
  const [animationState, setAnimationState] = useState<'initial' | 'animating' | 'done'>('initial');
  
  // Animation: trigger on mount only
  useEffect(() => {
    if (!noticeEnabled) {
      setAnimationState('initial');
      return;
    }
    
    if (noticeAnimation === 'none') {
      setAnimationState('done');
      return;
    }
    
    // Reset for animation
    setAnimationState('initial');
    
    // Use double RAF to ensure browser has painted initial state
    let frameId: number;
    const startAnimation = () => {
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => {
          setAnimationState('animating');
          // After animation completes, mark as done
          setTimeout(() => {
            setAnimationState('done');
          }, 300);
        });
      });
    };
    
    startAnimation();
    
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [noticeEnabled, noticeAnimation]);
  
  const { data: menuItems } = useQuery({
    queryKey: ['menu-items', menuId],
    queryFn: async () => {
      if (!menuId) return [];
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, label, url, item_type, ref_id, sort_order')
        .eq('menu_id', menuId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!menuId,
  });
  
  // Fetch promo page by ID
  const { data: promoPage } = useQuery({
    queryKey: ['header-promo-page', featuredPromosPageId],
    queryFn: async () => {
      if (!featuredPromosPageId) return null;
      const { data, error } = await supabase
        .from('store_pages')
        .select('id, slug, title, is_published')
        .eq('id', featuredPromosPageId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!featuredPromosPageId && featuredPromosEnabled,
  });
  
  // Effective promo slug: use fetched page or legacy slug
  const effectivePromoSlug = promoPage?.slug || featuredPromosPageSlug || '';
  
  const displayItems = menuItems || context?.headerMenu || [];
  
  // Get animation styles based on state
  const getNoticeAnimationStyles = (): React.CSSProperties => {
    // No animation
    if (noticeAnimation === 'none') {
      return { opacity: 1, transform: 'translateY(0)' };
    }
    
    const isAnimated = animationState === 'animating' || animationState === 'done';
    const transition = animationState === 'animating' ? 'opacity 250ms ease-out, transform 250ms ease-out' : 'none';
    
    if (noticeAnimation === 'fade') {
      return {
        opacity: isAnimated ? 1 : 0,
        transition,
      };
    }
    
    if (noticeAnimation === 'slide') {
      return {
        opacity: isAnimated ? 1 : 0,
        transform: isAnimated ? 'translateY(0)' : 'translateY(-100%)',
        transition,
      };
    }
    
    return { opacity: 1 };
  };
      
  // Check if action is valid (has URL and label)
  const isActionValid = noticeActionEnabled && noticeActionLabel && noticeActionUrl;
  
  // Render action element (link style)
  const renderAction = () => {
    if (!isActionValid && !isEditing) return null;
    
    const actionTextColor = noticeActionTextColor || noticeTextColor || '#ffffff';
    
    if (!isActionValid && isEditing) {
      return (
        <span 
          className="ml-2 underline text-xs opacity-50"
          style={{ color: actionTextColor }}
        >
          [Ação: configure texto e URL]
        </span>
      );
    }
    
    return (
      <a
        href={noticeActionUrl}
        target={noticeActionTarget}
        rel={noticeActionTarget === '_blank' ? 'noopener noreferrer' : undefined}
        className="ml-2 underline text-xs font-medium hover:opacity-80 transition-opacity"
        style={{ color: actionTextColor }}
        onClick={(e) => isEditing && e.preventDefault()}
      >
        {noticeActionLabel}
      </a>
    );
  };

  // Check if current style uses "menu below"
  const hasMenuBelow = headerStyle === 'logo_left_menu_below' || headerStyle === 'logo_center_menu_below';
  
  // Compute header styles
  const headerStyles: React.CSSProperties = {
    backgroundColor: headerBgColor || undefined,
    color: headerTextColor || undefined,
  };
  
  // Compute menu bar styles (for "menu below" layouts)
  const menuBarStyles: React.CSSProperties = hasMenuBelow ? {
    backgroundColor: menuBgColor || headerBgColor || undefined,
    color: menuTextColor || headerTextColor || undefined,
  } : {};
  
  // Icon color style
  const iconStyle: React.CSSProperties = {
    color: headerIconColor || headerTextColor || undefined,
  };
  
  // Normalize WhatsApp number (remove all non-digits)
  const normalizedWhatsApp = whatsAppNumber?.replace(/\D/g, '') || '';
  const isWhatsAppValid = showWhatsApp && normalizedWhatsApp.length >= 10;
  
  // Normalize phone number for tel: link
  const normalizedPhone = phoneNumber?.replace(/[^\d+]/g, '') || '';
  const isPhoneValid = showPhone && normalizedPhone.length >= 8;
  
  // Render logo section
  const renderLogo = () => (
    <div className="flex items-center gap-4">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={settings?.store_name} className="h-10" />
      ) : (
        <span className="text-xl font-bold" style={{ color: headerTextColor || undefined }}>
          {settings?.store_name || 'Loja'}
        </span>
      )}
    </div>
  );
  
  // Render menu items - only show actual menu items, no placeholder
  const renderMenuItems = (textColor?: string) => (
    <>
      {displayItems.map((item: any) => (
        <a 
          key={item.id} 
          href={item.url || '#'} 
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: textColor || undefined }}
        >
          {item.label}
        </a>
      ))}
    </>
  );
  
  // Render contact items (WhatsApp, Phone) - only show valid items, no placeholders
  const renderContactItems = () => {
    const items = [];
    
    // WhatsApp - only if valid
    if (isWhatsAppValid) {
      items.push(
        <a
          key="whatsapp"
          href={`https://wa.me/${normalizedWhatsApp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
          style={{ color: headerTextColor || undefined }}
          onClick={(e) => isEditing && e.preventDefault()}
        >
          <span style={iconStyle}>📱</span>
          <span className="hidden sm:inline">{whatsAppLabel || 'WhatsApp'}</span>
        </a>
      );
    }
    
    // Phone - only if valid
    if (isPhoneValid) {
      items.push(
        <a
          key="phone"
          href={`tel:${normalizedPhone}`}
          className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
          style={{ color: headerTextColor || undefined }}
          onClick={(e) => isEditing && e.preventDefault()}
        >
          <span style={iconStyle}>📞</span>
          <span className="hidden sm:inline">{phoneLabel || phoneNumber}</span>
        </a>
      );
    }
    
    if (items.length === 0) return null;
    
    return (
      <div className="flex items-center gap-4">
        {items}
      </div>
    );
  };
  
  // Render icons (search, cart)
  const renderIcons = () => (
    <div className="flex items-center gap-2">
      {showSearch && (
        <button className="p-2 hover:opacity-70 rounded transition-opacity" style={iconStyle}>
          🔍
        </button>
      )}
      {showCart && (
        <button className="p-2 hover:opacity-70 rounded transition-opacity" style={iconStyle}>
          🛒
        </button>
      )}
    </div>
  );
  
  // REMOVIDO: renderCategoriesMenu - menu vem exclusivamente do Menu Builder
  const renderCategoriesMenu = () => null;
  
  // REMOVIDO: renderFeaturedCategories - substitui por "Categoria em Destaque" única no painel
  const renderFeaturedCategories = () => null;
  
  // Render customer area link - only if enabled, no placeholder
  const renderCustomerArea = (textColor?: string) => {
    if (!customerAreaEnabled) return null;
    
    const baseUrl = context?.tenantSlug ? `/store/${context.tenantSlug}` : '';
    
    return (
      <a
        href={`${baseUrl}/minhas-compras`}
        className="text-sm hover:opacity-70 transition-opacity flex items-center gap-1"
        style={{ color: textColor || undefined }}
        onClick={(e) => isEditing && e.preventDefault()}
      >
        <span>👤</span>
        {customerAreaLabel || 'Minhas compras'}
      </a>
    );
  };
  
  // Render featured promos link - only if enabled and valid
  const renderFeaturedPromos = (defaultTextColor?: string) => {
    if (!featuredPromosEnabled) return null;
    
    const baseUrl = context?.tenantSlug ? `/store/${context.tenantSlug}` : '';
    const hasValidPage = effectivePromoSlug && effectivePromoSlug.trim().length > 0;
    
    // Don't render if no valid page
    if (!hasValidPage) return null;
    
    return (
      <a
        href={`${baseUrl}/page/${effectivePromoSlug}`}
        className="text-sm font-medium hover:opacity-70 transition-opacity"
        style={{ color: featuredPromosTextColor || defaultTextColor || '#d97706' }}
        onClick={(e) => isEditing && e.preventDefault()}
      >
        {featuredPromosLabel || 'Promoções'}
      </a>
    );
  };
  
  // Determine sticky classes based on device
  const stickyClasses = cn(
    // Desktop sticky
    sticky && 'md:sticky md:top-0 md:z-50',
    // Mobile sticky
    stickyOnMobile && 'sticky top-0 z-50 md:relative md:z-auto',
    // Both
    sticky && stickyOnMobile && 'sticky top-0 z-50'
  );
  
  // Check if we have any valid contact items to show (no placeholders)
  const hasContactItems = isWhatsAppValid || isPhoneValid;
  
  return (
    <div className={stickyClasses}>
      {/* Notice Bar (Barra Superior) - only renders if enabled */}
      {noticeEnabled && (
        <div 
          className="py-2 px-4 text-center text-sm flex items-center justify-center flex-wrap gap-1"
          style={{ 
            backgroundColor: noticeBgColor || '#1e40af',
            color: noticeTextColor || '#ffffff',
            ...getNoticeAnimationStyles(),
          }}
        >
          <span>{noticeText || ''}</span>
          {noticeActionEnabled && renderAction()}
        </div>
      )}
      
      {/* Main Header - Style: logo_left_menu_inline (default) */}
      {headerStyle === 'logo_left_menu_inline' && (
        <header className="border-b" style={headerStyles}>
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              {renderLogo()}
              {hasContactItems && (
                <div className="hidden lg:flex">
                  {renderContactItems()}
                </div>
              )}
            </div>
            <nav className="hidden md:flex items-center gap-6">
              {renderCategoriesMenu()}
              {renderMenuItems(headerTextColor)}
              {renderFeaturedCategories()}
              {renderFeaturedPromos(headerTextColor)}
              {renderCustomerArea(headerTextColor)}
            </nav>
            <div className="flex items-center gap-4">
              {hasContactItems && (
                <div className="flex lg:hidden">
                  {renderContactItems()}
                </div>
              )}
              {renderIcons()}
            </div>
          </div>
        </header>
      )}
      
      {/* Main Header - Style: logo_left_menu_below */}
      {headerStyle === 'logo_left_menu_below' && (
        <>
          <header className="border-b" style={headerStyles}>
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                {renderLogo()}
                {hasContactItems && renderContactItems()}
              </div>
              {renderIcons()}
            </div>
          </header>
          {/* Menu bar below with categories */}
          <nav 
            className="hidden md:block border-b"
            style={menuBarStyles}
          >
            <div className="container mx-auto px-4 py-2 flex items-center gap-6">
              {renderCategoriesMenu()}
              {renderMenuItems(menuTextColor || headerTextColor)}
              {renderFeaturedCategories()}
              {renderFeaturedPromos(menuTextColor || headerTextColor)}
              {renderCustomerArea(menuTextColor || headerTextColor)}
            </div>
          </nav>
        </>
      )}
      
      {/* Main Header - Style: logo_center_menu_below */}
      {headerStyle === 'logo_center_menu_below' && (
        <>
          <header className="border-b" style={headerStyles}>
            <div className="container mx-auto px-4 py-4 flex flex-col items-center gap-2">
              <div className="flex items-center justify-between w-full md:justify-center relative">
                {/* Contact items on the left */}
                <div className="md:absolute md:left-4 flex items-center">
                  {hasContactItems && renderContactItems()}
                </div>
                {renderLogo()}
                <div className="md:absolute md:right-4">
                  {renderIcons()}
                </div>
              </div>
            </div>
          </header>
          {/* Menu bar below, centered with categories */}
          <nav 
            className="hidden md:block border-b"
            style={menuBarStyles}
          >
            <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-6">
              {renderCategoriesMenu()}
              {renderMenuItems(menuTextColor || headerTextColor)}
              {renderFeaturedCategories()}
              {renderFeaturedPromos(menuTextColor || headerTextColor)}
              {renderCustomerArea(menuTextColor || headerTextColor)}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function FooterBlock({ menuId, showSocial = true, copyrightText, context, isEditing }: any) {
  const { settings } = context || {};
  
  const { data: menuItems } = useQuery({
    queryKey: ['menu-items', menuId],
    queryFn: async () => {
      if (!menuId) return [];
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, label, url, item_type, ref_id, sort_order')
        .eq('menu_id', menuId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!menuId,
  });
  
  const displayItems = menuItems || context?.footerMenu || [];
  
  return (
    <footer className="bg-muted/50 border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold mb-4">{settings?.store_name || 'Loja'}</h3>
            <p className="text-sm text-muted-foreground">
              {settings?.store_description || 'Sua loja online'}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Links</h4>
            <ul className="space-y-2">
              {displayItems.length > 0 ? (
                displayItems.map((item: any) => (
                  <li key={item.id}>
                    <a href={item.url || '#'} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {item.label}
                    </a>
                  </li>
                ))
              ) : (
                isEditing && (
                  <li className="text-sm text-muted-foreground">[Selecione um menu]</li>
                )
              )}
            </ul>
          </div>
          {showSocial && (
            <div>
              <h4 className="font-semibold mb-3">Redes Sociais</h4>
              <div className="flex gap-4 text-sm">
                {settings?.social_instagram && (
                  <a href={settings.social_instagram} className="hover:text-primary">Instagram</a>
                )}
                {settings?.social_facebook && (
                  <a href={settings.social_facebook} className="hover:text-primary">Facebook</a>
                )}
                {!settings?.social_instagram && !settings?.social_facebook && isEditing && (
                  <span className="text-muted-foreground">[Configure nas configurações]</span>
                )}
              </div>
            </div>
          )}
          <div>
            <h4 className="font-semibold mb-3">Contato</h4>
            {settings?.social_whatsapp ? (
              <a href={`https://wa.me/${settings.social_whatsapp}`} className="text-sm hover:text-primary">
                WhatsApp
              </a>
            ) : (
              isEditing && <span className="text-sm text-muted-foreground">[Configure WhatsApp]</span>
            )}
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          {copyrightText || `© ${new Date().getFullYear()} ${settings?.store_name || 'Loja'}. Todos os direitos reservados.`}
        </div>
      </div>
    </footer>
  );
}

// ========== CONTENT BLOCKS ==========

function HeroBlock({ 
  title, 
  subtitle, 
  buttonText, 
  buttonUrl, 
  backgroundImage, 
  backgroundColor, 
  textColor, 
  buttonColor, 
  buttonTextColor,
  buttonHoverBgColor,
  buttonHoverTextColor,
  height = 'md', 
  alignment = 'center', 
  overlayOpacity = 50 
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

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ 
        backgroundColor: backgroundImage ? undefined : (backgroundColor || 'hsl(var(--primary))'),
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: heightMap[height] || '400px',
      }}
    >
      {backgroundImage && (
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

function BannerBlock({ 
  imageUrl, 
  altText, 
  linkUrl, 
  height, 
  aspectRatio, 
  objectFit = 'cover',
  objectPosition = 'center',
  rounded = 'md',
  shadow = 'none',
}: any) {
  const aspectRatioMap: Record<string, string> = {
    '16:9': '56.25%',
    '4:3': '75%',
    '1:1': '100%',
    '21:9': '42.86%',
  };

  const roundedMap: Record<string, string> = {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
  };

  const shadowMap: Record<string, string> = {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  const content = (
    <div 
      className="w-full bg-muted overflow-hidden relative"
      style={{ 
        paddingBottom: height ? undefined : aspectRatioMap[aspectRatio] || '56.25%',
        height: height || undefined,
        borderRadius: roundedMap[rounded] || '0.5rem',
        boxShadow: shadowMap[shadow] || 'none',
      }}
    >
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={altText || 'Banner'} 
          className="absolute inset-0 w-full h-full" 
          style={{
            objectFit: objectFit || 'cover',
            objectPosition: objectPosition || 'center',
          }}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-muted-foreground">
          Banner Image
        </div>
      )}
    </div>
  );

  if (linkUrl) {
    return <a href={linkUrl}>{content}</a>;
  }

  return content;
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

function RichTextBlock({ content, align }: any) {
  // Convert markdown-like content to HTML
  const processContent = (text: string): string => {
    if (!text) return '<p>Conteúdo de texto formatado...</p>';
    
    // If already HTML, return as is
    if (text.includes('<')) return text;
    
    // Simple markdown conversion
    let html = text
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
      style={{ textAlign: align || 'left' }}
      dangerouslySetInnerHTML={{ __html: processContent(content) }}
    />
  );
}

function ImageBlock({ 
  src, 
  alt, 
  width, 
  height, 
  objectFit = 'cover',
  objectPosition = 'center',
  aspectRatio = 'auto',
  rounded = 'none',
  shadow = 'none',
  linkUrl,
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

  const imageContent = (
    <div 
      className="overflow-hidden" 
      style={{ 
        width: widthMap[width] || '100%',
        borderRadius: roundedMap[rounded] || '0',
        boxShadow: shadowMap[shadow] || 'none',
      }}
    >
      {src ? (
        <img 
          src={src} 
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
    <>
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
          'inline-block font-semibold transition-colors',
          sizeClasses[size] || sizeClasses.md
        )}
        style={{
          borderRadius: radiusMap[borderRadius] || '0.5rem',
        }}
      >
        {text || 'Botão'}
      </a>
    </>
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

function ProductCarouselBlock({ title, limit = 6, isEditing }: any) {
  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: limit }, (_, i) => (
          <div key={i} className="flex-shrink-0 w-48 bg-card border rounded-lg p-4">
            <div className="aspect-square bg-muted rounded mb-3" />
            <h3 className="font-medium truncate">Produto {i + 1}</h3>
            <p className="text-primary font-bold">R$ {(99.90 + i * 10).toFixed(2)}</p>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground">
          [Carrossel de produtos dinâmico]
        </p>
      )}
    </div>
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

function FeaturedProductsBlock({ title, productIds, isEditing }: any) {
  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-card border rounded-lg p-4">
            <div className="aspect-square bg-muted rounded mb-3" />
            <h3 className="font-medium">Produto Destaque {i + 1}</h3>
            <p className="text-primary font-bold">R$ {(199.90 + i * 50).toFixed(2)}</p>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Produtos em destaque - IDs: {productIds?.join(', ') || 'Nenhum selecionado'}]
        </p>
      )}
    </div>
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
  const { data: exampleProduct, isLoading } = useQuery({
    queryKey: ['example-product', exampleProductId, context?.productId],
    queryFn: async () => {
      const productId = context?.productId || exampleProductId;
      
      let query = supabase
        .from('products')
        .select(`
          id, name, price, description, stock_quantity, status,
          product_images (id, url, alt_text, is_primary, sort_order)
        `);
      
      if (productId && productId !== '_auto') {
        query = query.eq('id', productId);
      } else {
        query = query.eq('status', 'active').limit(1);
      }
      
      const { data, error } = await query.single();
      if (error) return null;
      return data;
    },
    enabled: isEditing || !!context?.productId,
  });
  
  const product = isEditing ? exampleProduct : context?.product || exampleProduct;
  const primaryImage = product?.product_images?.find((img: any) => img.is_primary) || product?.product_images?.[0];

  if (isLoading) {
    return (
      <div className="py-8 animate-pulse">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-muted rounded-lg" />
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
      <div className="py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            [Imagem do Produto]
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">[Nome do Produto]</h1>
            <p className="text-2xl text-primary font-bold">[Preço]</p>
            <p className="text-muted-foreground">[Descrição do produto será exibida aqui]</p>
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg">
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Selecione um produto de exemplo para visualizar ou use o seletor no toolbar]
        </p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {showGallery && (
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            {primaryImage?.url ? (
              <img src={primaryImage.url} alt={product?.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>
        )}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{product?.name || 'Produto'}</h1>
          <p className="text-2xl text-primary font-bold">
            R$ {(product?.price || 0).toFixed(2).replace('.', ',')}
          </p>
          {showDescription && product?.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}
          {showStock && (
            <p className="text-sm text-muted-foreground">
              Estoque: {product?.stock_quantity || 0} unidades
            </p>
          )}
          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90">
            Adicionar ao Carrinho
          </button>
        </div>
      </div>
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

function FAQBlock({ title, items, isEditing }: any) {
  const faqItems = items || [
    { question: 'Pergunta de exemplo 1?', answer: 'Resposta de exemplo 1.' },
    { question: 'Pergunta de exemplo 2?', answer: 'Resposta de exemplo 2.' },
  ];

  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="space-y-4">
        {faqItems.map((item: any, i: number) => (
          <div key={i} className="border rounded-lg">
            <div className="p-4 font-semibold bg-muted/50 rounded-t-lg">
              {item.question}
            </div>
            <div className="p-4 text-muted-foreground">
              {item.answer}
            </div>
          </div>
        ))}
      </div>
      {isEditing && (
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
