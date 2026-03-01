import { Link } from 'react-router-dom';
import { getLogoImageUrl } from '@/lib/imageTransform';
import { Search, ShoppingCart, Menu, Phone, MessageCircle, User, Mail, Facebook, Instagram, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { buildMenuItemUrl, getStoreBaseUrl } from '@/lib/publicUrls';
import { cn } from '@/lib/utils';
import { 
  getWhatsAppHref, 
  getPhoneHref, 
  getEmailHref,
  isValidWhatsApp,
  isValidPhone,
  isValidEmail
} from '@/lib/contactHelpers';
import { HeaderAttendanceDropdown } from './HeaderAttendanceDropdown';

interface HeaderConfig {
  props?: Record<string, any>;
}

interface StoreSettings {
  logo_url?: string | null;
  store_name?: string | null;
  primary_color?: string | null;
  social_whatsapp?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  contact_support_hours?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
}

interface MenuItem {
  id: string;
  label: string;
  url?: string | null;
  item_type: string;
  ref_id?: string | null;
  sort_order?: number | null;
  parent_id?: string | null;
}

interface MenuItemWithChildren extends MenuItem {
  children: MenuItemWithChildren[];
}

interface Category {
  id: string;
  slug: string;
  name?: string;
}

interface PageData {
  id: string;
  slug: string;
  type: string;
}

interface StorefrontHeaderContentProps {
  tenantSlug: string;
  headerConfig?: HeaderConfig | null;
  storeSettings?: StoreSettings | null;
  menuItems?: MenuItem[];
  categories?: Category[];
  pagesData?: PageData[];
  totalCartItems?: number;
  isEditing?: boolean;
  tenantId?: string;
  viewportOverride?: 'desktop' | 'tablet' | 'mobile';
}

export function StorefrontHeaderContent({
  tenantSlug,
  headerConfig,
  storeSettings,
  menuItems = [],
  categories = [],
  pagesData = [],
  totalCartItems = 0,
  isEditing = false,
  tenantId,
  viewportOverride,
}: StorefrontHeaderContentProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [animationState, setAnimationState] = useState<'initial' | 'animating' | 'done'>('initial');
  const noticeRef = useRef<HTMLDivElement>(null);

  const props = headerConfig?.props || {};
  
  // Extract header props from config
  const showSearch = props.showSearch ?? true;
  const showCart = props.showCart ?? true;
  const sticky = props.sticky ?? true;
  const stickyOnMobile = props.stickyOnMobile ?? true;
  const headerBgColor = String(props.headerBgColor || '');
  const headerTextColor = String(props.headerTextColor || '');
  const headerIconColor = String(props.headerIconColor || '');
  
  // Notice bar props
  const noticeEnabled = Boolean(props.noticeEnabled);
  const noticeText = String(props.noticeText || '');
  const noticeTexts: string[] = Array.isArray(props.noticeTexts) && props.noticeTexts.length > 0 
    ? props.noticeTexts.filter((t: any) => typeof t === 'string' && t.trim())
    : noticeText ? [noticeText] : [];
  // RULE: Custom colors from builder OVERRIDE theme colors when set
  // Empty string or null means "inherit from theme"
  const rawNoticeBgColor = props.noticeBgColor;
  const noticeBgColor = rawNoticeBgColor && String(rawNoticeBgColor).trim() !== '' 
    ? String(rawNoticeBgColor) 
    : ''; // Empty = will use theme fallback in style
  const rawNoticeTextColor = props.noticeTextColor;
  const noticeTextColor = rawNoticeTextColor && String(rawNoticeTextColor).trim() !== '' 
    ? String(rawNoticeTextColor) 
    : ''; // Empty = will use theme fallback in style
  // Backward compatibility: map old 'slide' to 'slide-vertical'
  const rawNoticeAnimation = String(props.noticeAnimation || 'fade');
  const noticeAnimation = (rawNoticeAnimation === 'slide' ? 'slide-vertical' : rawNoticeAnimation) as 'none' | 'fade' | 'slide-vertical' | 'slide-horizontal' | 'marquee';
  const noticeActionEnabled = Boolean(props.noticeActionEnabled);
  const noticeActionLabel = String(props.noticeActionLabel || '');
  const noticeActionUrl = String(props.noticeActionUrl || '');
  const noticeActionTarget = String(props.noticeActionTarget || '_self') as '_self' | '_blank';
  const noticeActionTextColor = String(props.noticeActionTextColor || '');
  
  // Contact props - NOW pulled directly from store_settings (single source of truth)
  // The toggle from header_config is removed - contact info always comes from store settings
  const whatsAppNumber = String(storeSettings?.social_whatsapp || '');
  const phoneNumber = String(storeSettings?.contact_phone || '');
  const emailAddress = String(storeSettings?.contact_email || '');
  
  // Extended contact props from store_settings
  const storeAddress = String(storeSettings?.contact_address || '');
  const businessHours = String(storeSettings?.contact_support_hours || '');
  
  // Customer area props
  const customerAreaEnabled = Boolean(props.customerAreaEnabled);
  
  // Header menu visibility (from page overrides)
  const showHeaderMenu = props.showHeaderMenu !== undefined ? Boolean(props.showHeaderMenu) : true;
  
  // SAC/Atendimento visibility (for checkout)
  const showSac = props.showSac !== undefined ? Boolean(props.showSac) : true;
  
  // Security seals visibility (for checkout header - independent from footer seals)
  const showSecuritySeals = props.showSecuritySeals !== undefined ? Boolean(props.showSecuritySeals) : false;
  
  // Logo position (for checkout: left, center, right)
  const logoPosition = String(props.logoPosition || 'center') as 'left' | 'center' | 'right';
  
  // Featured promos props
  const featuredPromosEnabled = Boolean(props.featuredPromosEnabled);
  const featuredPromosLabel = String(props.featuredPromosLabel || 'Promoções');
  const featuredPromosTextColor = String(props.featuredPromosTextColor || '');
  const featuredPromosBgColor = String(props.featuredPromosBgColor || '');
  const featuredPromosDestination = String(props.featuredPromosTarget || props.featuredPromosDestination || '');
  const featuredPromosThumbnail = String(props.featuredPromosThumbnail || '');
  
  // Menu visual style - 'classic', 'elegant', 'minimal'
  const menuVisualStyle = String(props.menuVisualStyle || 'classic') as 'classic' | 'elegant' | 'minimal';
  const menuShowParentTitle = props.menuShowParentTitle !== undefined ? Boolean(props.menuShowParentTitle) : true;
  
  // Logo size - 'small', 'medium', 'large'
  const logoSize = String(props.logoSize || 'medium') as 'small' | 'medium' | 'large';
  
  // Logo URL - props.logoUrl has PRIORITY over storeSettings.logo_url
  // This allows checkout to have a different logo or inherit from global layout
  const rawLogoUrl = props.logoUrl && String(props.logoUrl).trim() !== '' 
    ? String(props.logoUrl) 
    : storeSettings?.logo_url || '';
  const effectiveLogoUrl = getLogoImageUrl(rawLogoUrl, 300);
  
  // Nav bar height - 'small', 'medium', 'large'
  const navBarHeight = String(props.navBarHeight || 'medium') as 'small' | 'medium' | 'large';
  
  // Get nav bar height in pixels based on navBarHeight prop
  const getNavBarHeight = (): string => {
    switch (navBarHeight) {
      case 'small':
        return '32px';
      case 'large':
        return '52px';
      case 'medium':
      default:
        return '40px';
    }
  };
  
  // Get logo size classes based on logoSize prop
  const getLogoSizeClasses = (): string => {
    switch (logoSize) {
      case 'small':
        return 'h-8 max-w-[100px] md:max-w-[120px]';
      case 'large':
        return 'h-14 max-w-[180px] md:max-w-[220px]';
      case 'medium':
      default:
        return 'h-10 max-w-[140px] md:max-w-[160px]';
    }
  };
  
  // Featured promo hover state
  const [featuredPromoHover, setFeaturedPromoHover] = useState(false);
  
  // State for rotating through multiple notice texts
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  const [noticeTransitionState, setNoticeTransitionState] = useState<'visible' | 'exiting' | 'entering'>('visible');
  
  // Social media - from store_settings
  const socialFacebook = storeSettings?.social_facebook || null;
  const socialInstagram = storeSettings?.social_instagram || null;

  // Get current notice text based on rotation
  const currentNoticeText = noticeTexts.length > 0 ? noticeTexts[currentNoticeIndex % noticeTexts.length] : '';

  // Animation effect for notice bar - initial fade in
  useEffect(() => {
    if (!noticeEnabled) {
      setAnimationState('initial');
      return;
    }
    if (noticeAnimation === 'none' || noticeAnimation === 'marquee') {
      setAnimationState('done');
      return;
    }
    setAnimationState('initial');
    let frameId: number;
    const startAnimation = () => {
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => {
          setAnimationState('animating');
          setTimeout(() => setAnimationState('done'), 300);
        });
      });
    };
    startAnimation();
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [noticeEnabled, noticeAnimation]);

  // Rotation effect for multiple notice texts (fade/slide only)
  useEffect(() => {
    if (!noticeEnabled || noticeTexts.length <= 1) return;
    if (noticeAnimation === 'none' || noticeAnimation === 'marquee') return;

    const rotationInterval = setInterval(() => {
      // Start exit animation
      setNoticeTransitionState('exiting');
      
      setTimeout(() => {
        // Change to next text
        setCurrentNoticeIndex(prev => (prev + 1) % noticeTexts.length);
        setNoticeTransitionState('entering');
        
        setTimeout(() => {
          setNoticeTransitionState('visible');
        }, 300);
      }, 300);
    }, 4000); // Rotate every 4 seconds

    return () => clearInterval(rotationInterval);
  }, [noticeEnabled, noticeAnimation, noticeTexts.length]);

  // Use centralized URL builder
  const baseUrl = getStoreBaseUrl(tenantSlug || '');

  // Parse featured promos destination to generate URL
  const getFeaturedPromosUrl = (): string | null => {
    if (!featuredPromosDestination || !tenantSlug) return null;
    
    if (featuredPromosDestination.startsWith('category:')) {
      const categorySlug = featuredPromosDestination.replace('category:', '');
      return `${baseUrl}/c/${categorySlug}`;
    }
    if (featuredPromosDestination.startsWith('page:')) {
      const pageSlug = featuredPromosDestination.replace('page:', '');
      return `${baseUrl}/page/${pageSlug}`;
    }
    return null;
  };
  
  const featuredPromosUrl = featuredPromosEnabled ? getFeaturedPromosUrl() : null;

  const getMenuItemUrl = (item: MenuItem): string => {
    if (!tenantSlug) return '/';
    return buildMenuItemUrl(
      tenantSlug,
      { item_type: item.item_type, url: item.url, ref_id: item.ref_id },
      categories?.map(c => ({ id: c.id, slug: c.slug })) || [],
      pagesData || []
    );
  };

  // Use CSS variable from themeSettings instead of legacy store_settings.primary_color
  // The --theme-button-primary-bg is injected by useBuilderThemeInjector (builder) or StorefrontThemeInjector (public)
  const primaryColor = 'var(--theme-button-primary-bg, #1a1a1a)';
  
  // Organize menu items into hierarchy (parents with children)
  const hierarchicalMenuItems = useMemo((): MenuItemWithChildren[] => {
    if (!menuItems || menuItems.length === 0) return [];
    
    const itemMap = new Map<string, MenuItemWithChildren>();
    const rootItems: MenuItemWithChildren[] = [];
    
    // First pass: create all items with empty children arrays
    menuItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });
    
    // Second pass: organize into hierarchy
    menuItems.forEach(item => {
      const itemWithChildren = itemMap.get(item.id)!;
      const hasParent = item.parent_id !== null && item.parent_id !== undefined && item.parent_id !== '';
      
      if (hasParent && itemMap.has(item.parent_id!)) {
        itemMap.get(item.parent_id!)!.children.push(itemWithChildren);
      } else {
        rootItems.push(itemWithChildren);
      }
    });
    
    // Sort children by sort_order
    rootItems.forEach(item => {
      item.children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
    
    return rootItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [menuItems]);

  // State for dropdown hover (desktop)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for mobile menu dropdowns (toggle on click)
  const [openMobileDropdowns, setOpenMobileDropdowns] = useState<Set<string>>(new Set());

  const handleDropdownEnter = (itemId: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setOpenDropdown(itemId);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
  };
  
  // Toggle mobile dropdown
  const toggleMobileDropdown = (itemId: string) => {
    setOpenMobileDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };
  
  // Use helper functions for validation - now checking directly if data exists
  const whatsAppHref = getWhatsAppHref(whatsAppNumber);
  const phoneHref = getPhoneHref(phoneNumber);
  const emailHref = getEmailHref(emailAddress);
  const isWhatsAppValid = isValidWhatsApp(whatsAppNumber);
  const isPhoneValidFlag = isValidPhone(phoneNumber);
  const isEmailValid = isValidEmail(emailAddress);
  
  // Check if any contact info is available for the dropdown
  const hasContactInfo = isWhatsAppValid || isPhoneValidFlag || isEmailValid || storeAddress || businessHours;
  
  // Get animation styles for notice bar (considering rotation transitions)
  const getNoticeAnimationStyles = (): React.CSSProperties => {
    if (noticeAnimation === 'none') return { opacity: 1, transform: 'translateY(0)' };
    if (noticeAnimation === 'marquee') return { opacity: 1 }; // Marquee handled via CSS animation class
    
    // For multiple texts with rotation
    if (noticeTexts.length > 1 && animationState === 'done') {
      const isVisible = noticeTransitionState === 'visible';
      const isExiting = noticeTransitionState === 'exiting';
      const isEntering = noticeTransitionState === 'entering';
      
      if (noticeAnimation === 'fade') {
        return {
          opacity: isVisible ? 1 : isEntering ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        };
      }
      if (noticeAnimation === 'slide-vertical') {
        return {
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'translateY(-100%)' : isEntering ? 'translateY(0)' : 'translateY(0)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        };
      }
      if (noticeAnimation === 'slide-horizontal') {
        return {
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'translateX(-100%)' : isEntering ? 'translateX(0)' : 'translateX(0)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        };
      }
    }
    
    // Initial animation (first load)
    const isAnimated = animationState === 'animating' || animationState === 'done';
    const transition = animationState === 'animating' ? 'opacity 250ms ease-out, transform 250ms ease-out' : 'none';
    
    if (noticeAnimation === 'fade') return { opacity: isAnimated ? 1 : 0, transition };
    if (noticeAnimation === 'slide-vertical') return { opacity: isAnimated ? 1 : 0, transform: isAnimated ? 'translateY(0)' : 'translateY(-100%)', transition };
    if (noticeAnimation === 'slide-horizontal') return { opacity: isAnimated ? 1 : 0, transform: isAnimated ? 'translateX(0)' : 'translateX(-100%)', transition };
    
    return { opacity: 1 };
  };
  
  const isActionValid = noticeActionEnabled && noticeActionLabel && noticeActionUrl;

  const headerStyles: React.CSSProperties = {
    backgroundColor: headerBgColor || undefined,
    color: headerTextColor || undefined,
  };

  const iconStyle: React.CSSProperties = {
    color: headerIconColor || headerTextColor || undefined,
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isEditing) {
      e.preventDefault();
    }
  };

  // Wrapper component for links that works in both editing and public mode
  const LinkWrapper = ({ to, children, className, style, onClick }: any) => {
    if (isEditing) {
      return (
        <span className={className} style={style} onClick={onClick}>
          {children}
        </span>
      );
    }
    return (
      <Link to={to} className={className} style={style} onClick={onClick}>
        {children}
      </Link>
    );
  };

  // Determine layout mode based on viewportOverride (from builder) or CSS will handle it for public
  const forceMobile = viewportOverride === 'mobile' || viewportOverride === 'tablet';
  const forceDesktop = viewportOverride === 'desktop';

  // ============================================
  // DEMO DATA: Show demo content for empty sections in editor mode
  // Each section shows demo ONLY when that specific section is empty
  // ============================================
  const hasLogo = Boolean(storeSettings?.logo_url);
  const hasStoreName = Boolean(storeSettings?.store_name);
  
  // Demo store name when no real name/logo
  const demoStoreName = 'Minha Loja';
  const displayStoreName = storeSettings?.store_name || (isEditing ? demoStoreName : 'Loja');
  
  // Demo contact info for header dropdown
  const demoContactInfo = isEditing && !hasContactInfo ? {
    phone: '(11) 99999-9999',
    whatsapp: '(11) 99999-9999',
    email: 'contato@minhaloja.com',
    address: 'Av. Exemplo, 1000 - São Paulo, SP',
    hours: 'Seg a Sex: 9h às 18h',
  } : null;

  return (
    <header 
      className={cn(
        "z-50 w-full border-b shadow-sm relative bg-background",
        sticky && !forceMobile && "md:sticky md:top-0",
        stickyOnMobile && "sticky top-0"
      )}
      style={{ ...headerStyles, backgroundColor: headerBgColor || 'white' }}
    >
      {/* Notice Bar */}
      {noticeEnabled && (noticeTexts.length > 0 || noticeText) && (
        <div
          ref={noticeRef}
          className={cn(
            "px-4 py-2 text-center text-sm overflow-hidden",
            noticeAnimation === 'marquee' && "whitespace-nowrap"
          )}
          style={{
            // RULE: Custom colors OVERRIDE theme colors when set (non-empty)
            // Empty = inherit from theme (--theme-button-primary-bg)
            backgroundColor: noticeBgColor || 'var(--theme-button-primary-bg, #1a1a1a)',
            color: noticeTextColor || 'var(--theme-button-primary-text, #ffffff)',
            ...(noticeAnimation !== 'marquee' ? getNoticeAnimationStyles() : {}),
          }}
        >
          {noticeAnimation === 'marquee' ? (
            <div className="animate-marquee inline-flex whitespace-nowrap">
              <span className="px-8">{noticeText || noticeTexts[0]}</span>
              {isActionValid && (
                <a
                  href={noticeActionUrl}
                  target={noticeActionTarget}
                  rel={noticeActionTarget === '_blank' ? 'noopener noreferrer' : undefined}
                  className="px-2 underline text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: noticeActionTextColor || noticeTextColor }}
                  onClick={handleLinkClick}
                >
                  {noticeActionLabel}
                </a>
              )}
              {/* Duplicate for seamless loop - text moves from 0 to -50%, then second copy appears */}
              <span className="px-8" aria-hidden="true">{noticeText || noticeTexts[0]}</span>
              {isActionValid && (
                <a
                  href={noticeActionUrl}
                  target={noticeActionTarget}
                  rel={noticeActionTarget === '_blank' ? 'noopener noreferrer' : undefined}
                  className="px-2 underline text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: noticeActionTextColor || noticeTextColor }}
                  onClick={handleLinkClick}
                  aria-hidden="true"
                >
                  {noticeActionLabel}
                </a>
              )}
            </div>
          ) : (
            <div style={getNoticeAnimationStyles()}>
              <span>{currentNoticeText || noticeText}</span>
              {isActionValid && (
                <a
                  href={noticeActionUrl}
                  target={noticeActionTarget}
                  rel={noticeActionTarget === '_blank' ? 'noopener noreferrer' : undefined}
                  className="ml-2 underline text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: noticeActionTextColor || noticeTextColor }}
                  onClick={handleLinkClick}
                >
                  {noticeActionLabel}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="container mx-auto px-4">
        {/* 
          DESKTOP LAYOUT: 3 regions - LEFT (Search) | CENTER (Logo) | RIGHT (Atendimento + Account + Cart)
          MOBILE LAYOUT: Standard mobile header with hamburger
        */}
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* === MOBILE LAYOUT === */}
          {(forceMobile || !forceDesktop) && (
            <div className={cn(
              "flex items-center",
              forceDesktop ? "hidden" : (forceMobile ? "flex" : "flex md:hidden")
            )}>
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="z-10">
                    <Menu className="h-5 w-5" style={iconStyle} />
                  </Button>
                </SheetTrigger>
                <SheetContent 
                  side="left" 
                  className="w-[300px] z-[100]" 
                  aria-describedby={undefined}
                  style={{
                    backgroundColor: headerBgColor || undefined,
                    color: headerTextColor || undefined,
                  }}
                >
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                  <div className="flex flex-col gap-4 mt-8">
                    {showSearch && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Buscar produtos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    )}

                    {/* Mobile Navigation with hierarchy */}
                    {showHeaderMenu && <nav className="flex flex-col gap-1">
                      {hierarchicalMenuItems.length > 0 ? (
                        hierarchicalMenuItems.map((item) => (
                          <div key={item.id}>
                            {item.children.length > 0 ? (
                              <>
                                <div className="flex items-center">
                                  <LinkWrapper
                                    to={getMenuItemUrl(item)}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex-1 py-3 px-4 text-sm font-medium hover:opacity-70 rounded-l-lg"
                                    style={{ color: headerTextColor || undefined }}
                                  >
                                    {item.label}
                                  </LinkWrapper>
                                  <button
                                    type="button"
                                    onClick={() => toggleMobileDropdown(item.id)}
                                    className="py-3 px-3 hover:opacity-70 rounded-r-lg"
                                    style={{ color: headerTextColor || undefined }}
                                    aria-label={openMobileDropdowns.has(item.id) ? 'Fechar submenu' : 'Abrir submenu'}
                                  >
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      openMobileDropdowns.has(item.id) && "rotate-180"
                                    )} />
                                  </button>
                                </div>
                                {openMobileDropdowns.has(item.id) && (
                                  <div className="ml-4 border-l-2" style={{ borderColor: headerTextColor ? `${headerTextColor}30` : undefined }}>
                                    {item.children.map((child) => (
                                      <div key={child.id}>
                                        {child.children && child.children.length > 0 ? (
                                          <>
                                            <div className="flex items-center">
                                              <LinkWrapper
                                                to={getMenuItemUrl(child)}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex-1 py-2 px-4 text-sm opacity-80 hover:opacity-100 rounded-l-lg transition-colors"
                                                style={{ color: headerTextColor || undefined }}
                                              >
                                                {child.label}
                                              </LinkWrapper>
                                              <button
                                                type="button"
                                                onClick={() => toggleMobileDropdown(child.id)}
                                                className="py-2 px-3 opacity-80 hover:opacity-100 rounded-r-lg transition-colors"
                                                style={{ color: headerTextColor || undefined }}
                                                aria-label={openMobileDropdowns.has(child.id) ? 'Fechar submenu' : 'Abrir submenu'}
                                              >
                                                <ChevronDown className={cn(
                                                  "h-3 w-3 transition-transform duration-200",
                                                  openMobileDropdowns.has(child.id) && "rotate-180"
                                                )} />
                                              </button>
                                            </div>
                                            {openMobileDropdowns.has(child.id) && (
                                              <div className="ml-4 border-l-2" style={{ borderColor: headerTextColor ? `${headerTextColor}20` : undefined }}>
                                                {child.children.map((grandchild) => (
                                                  <LinkWrapper
                                                    key={grandchild.id}
                                                    to={getMenuItemUrl(grandchild)}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="py-2 px-4 text-sm opacity-80 hover:opacity-100 rounded-lg block transition-colors"
                                                    style={{ color: headerTextColor || undefined }}
                                                  >
                                                    {grandchild.label}
                                                  </LinkWrapper>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <LinkWrapper
                                            to={getMenuItemUrl(child)}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="py-2 px-4 text-sm opacity-80 hover:opacity-100 rounded-lg block transition-colors"
                                            style={{ color: headerTextColor || undefined }}
                                          >
                                            {child.label}
                                          </LinkWrapper>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <LinkWrapper
                                to={getMenuItemUrl(item)}
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-3 px-4 text-sm font-medium hover:opacity-70 rounded-lg flex items-center justify-between"
                                style={{ color: headerTextColor || undefined }}
                              >
                                {item.label}
                              </LinkWrapper>
                            )}
                          </div>
                        ))
                      ) : isEditing ? (
                        // Demo menu items for mobile when no real menu
                        <>
                          {['Categorias', 'Novidades', 'Promoções', 'Sobre'].map((label, i) => (
                            <span
                              key={i}
                              className="py-3 px-4 text-sm font-medium opacity-50 cursor-default"
                              style={{ color: headerTextColor || undefined }}
                            >
                              {label}
                            </span>
                          ))}
                          <p className="text-xs opacity-40 italic px-4 mt-2" style={{ color: headerTextColor || undefined }}>
                            [Demo] Configure em Menus
                          </p>
                        </>
                      ) : null}
                      
                      {/* Featured Promos (Mobile) */}
                      {featuredPromosEnabled && featuredPromosUrl && (
                        <LinkWrapper
                          to={featuredPromosUrl}
                          onClick={() => setMobileMenuOpen(false)}
                          className="py-3 px-4 text-sm font-bold rounded-lg inline-flex"
                          style={{ 
                            color: featuredPromosTextColor || headerTextColor || undefined,
                            backgroundColor: featuredPromosBgColor ? `${featuredPromosBgColor}20` : undefined,
                          }}
                        >
                          {featuredPromosLabel}
                        </LinkWrapper>
                      )}
                      
                      {/* Customer Area (Mobile) */}
                      {customerAreaEnabled && (
                        <LinkWrapper
                          to={`${baseUrl}/conta`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="py-3 px-4 text-sm font-medium hover:opacity-70 rounded-lg flex items-center gap-2"
                          style={{ color: headerTextColor || undefined }}
                        >
                          <User className="h-4 w-4" />
                          Minha Conta
                        </LinkWrapper>
                      )}
                    </nav>}

                    {/* Contact Section (Mobile Drawer) */}
                    {(isWhatsAppValid || isPhoneValidFlag || isEmailValid) && (
                      <div className="border-t pt-4 mt-2" style={{ borderColor: headerTextColor ? `${headerTextColor}20` : undefined }}>
                        <p className="text-xs font-semibold uppercase mb-3 px-4 opacity-60" style={{ color: headerTextColor || undefined }}>Contato</p>
                        <div className="flex flex-col gap-1">
                          {isWhatsAppValid && whatsAppHref && (
                            <a
                              href={whatsAppHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-3 px-4 text-sm font-medium hover:opacity-70 rounded-lg flex items-center gap-3"
                              style={{ color: headerTextColor || undefined }}
                              onClick={handleLinkClick}
                            >
                              <MessageCircle className="h-5 w-5" style={{ color: headerTextColor || 'var(--theme-accent-color, #22c55e)' }} />
                              WhatsApp
                            </a>
                          )}
                          {isPhoneValidFlag && phoneHref && (
                            <a
                              href={phoneHref}
                              className="py-3 px-4 text-sm font-medium hover:opacity-70 rounded-lg flex items-center gap-3"
                              style={{ color: headerTextColor || undefined }}
                              onClick={handleLinkClick}
                            >
                              <Phone className="h-5 w-5" style={{ color: headerTextColor || 'var(--theme-button-primary-bg, #1a1a1a)' }} />
                              Telefone
                            </a>
                          )}
                          {isEmailValid && emailHref && (
                            <a
                              href={emailHref}
                              className="py-3 px-4 text-sm font-medium hover:opacity-70 rounded-lg flex items-center gap-3"
                              style={{ color: headerTextColor || undefined }}
                              onClick={handleLinkClick}
                            >
                              <Mail className="h-5 w-5" style={{ color: headerTextColor || 'var(--theme-button-primary-bg, #1a1a1a)' }} />
                              Email
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Social Media Section (Mobile Drawer) */}
                    {(socialFacebook || socialInstagram) && (
                      <div className="border-t pt-4 mt-2" style={{ borderColor: headerTextColor ? `${headerTextColor}20` : undefined }}>
                        <p className="text-xs font-semibold uppercase mb-3 px-4 opacity-60" style={{ color: headerTextColor || undefined }}>Redes Sociais</p>
                        <div className="flex gap-4 px-4">
                          {socialFacebook && (
                            <a 
                              href={socialFacebook} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 hover:opacity-70 rounded-lg"
                              onClick={handleLinkClick}
                            >
                              <Facebook className="h-6 w-6" style={{ color: headerTextColor || '#1877F2' }} />
                            </a>
                          )}
                          {socialInstagram && (
                            <a 
                              href={socialInstagram} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 hover:opacity-70 rounded-lg"
                              onClick={handleLinkClick}
                            >
                              <Instagram className="h-6 w-6" style={{ color: headerTextColor || '#E4405F' }} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}

          {/* === DESKTOP LEFT REGION: Search === */}
          {(forceDesktop || !forceMobile) && (
            <div className={cn(
              "flex items-center gap-4 flex-1",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
            )}>
              {/* Search - now on the left */}
              {showSearch && (
                <div className="max-w-[220px] w-full">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Pesquisar"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-8 pr-3 text-sm bg-muted/30 border-muted-foreground/20 focus:border-primary/50 placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === CENTER REGION: Logo (position controlled by logoPosition prop) === */}
          <LinkWrapper 
            to={baseUrl || '/'} 
            className={cn(
              "flex items-center gap-2 shrink-0",
              // Mobile: always centered
              forceMobile ? "absolute left-1/2 -translate-x-1/2" : 
              // Desktop with logoPosition
              forceDesktop ? (
                logoPosition === 'left' ? "order-first mr-auto" :
                logoPosition === 'right' ? "order-last ml-auto" :
                "static translate-x-0"
              ) : 
              // Responsive: mobile centered, desktop respects logoPosition
              logoPosition === 'left' ? "absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 md:order-first md:mr-auto" :
              logoPosition === 'right' ? "absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 md:order-last md:ml-auto" :
              "absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"
            )}
          >
            {effectiveLogoUrl ? (
              <img
                src={effectiveLogoUrl}
                alt={storeSettings?.store_name || 'Loja'}
                className={cn(getLogoSizeClasses(), "object-contain")}
                width={180}
                height={60}
                loading="eager"
                decoding="async"
              />
            ) : (
              <span
                className={cn(
                  "text-lg md:text-xl font-bold",
                  isEditing && !hasStoreName && "opacity-50"
                )}
                style={{ color: headerTextColor || primaryColor }}
              >
                {displayStoreName}
                {isEditing && !hasStoreName && (
                  <span className="text-xs font-normal ml-1 text-muted-foreground/50">[Demo]</span>
                )}
              </span>
            )}
          </LinkWrapper>

          {/* === DESKTOP RIGHT REGION: Attendance Dropdown + Account Icon + Cart Icon === */}
          {(forceDesktop || !forceMobile) && (
            <div className={cn(
              "flex items-center justify-end gap-3",
              logoPosition === 'left' ? "flex-1" : logoPosition === 'right' ? "flex-1 order-first" : "flex-1",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
            )}>
              {/* Attendance Dropdown - Shows demo when no real contact in editor */}
              {showSac && (hasContactInfo || isEditing) && (
                <HeaderAttendanceDropdown
                  phoneNumber={demoContactInfo?.phone || phoneNumber}
                  whatsAppNumber={demoContactInfo?.whatsapp || whatsAppNumber}
                  emailAddress={demoContactInfo?.email || emailAddress}
                  address={demoContactInfo?.address || storeAddress}
                  businessHours={demoContactInfo?.hours || businessHours}
                  headerTextColor={headerTextColor}
                  headerIconColor={headerIconColor}
                  isEditing={isEditing}
                  isDemo={Boolean(demoContactInfo)}
                />
              )}
              
              {/* Customer Area - Icon only on desktop */}
              {customerAreaEnabled && (
                <LinkWrapper
                  to={`${baseUrl}/conta`}
                  className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
                  title="Minha Conta"
                >
                  <User className="h-5 w-5" style={iconStyle} />
                </LinkWrapper>
              )}
              
              {/* Cart */}
              {showCart && (
                <LinkWrapper to={`${baseUrl}/cart`}>
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart className="h-5 w-5" style={iconStyle} />
                    {totalCartItems > 0 && (
                      <span
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {totalCartItems}
                      </span>
                    )}
                  </Button>
                </LinkWrapper>
              )}
            </div>
          )}

          {/* === MOBILE RIGHT REGION: Actions === */}
          {(forceMobile || !forceDesktop) && (
            <div className={cn(
              "flex items-center gap-2",
              forceDesktop ? "hidden" : (forceMobile ? "flex" : "flex md:hidden")
            )}>
              {/* Customer area icon - Mobile */}
              {customerAreaEnabled && (
                <LinkWrapper to={`${baseUrl}/conta`}>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" style={iconStyle} />
                  </Button>
                </LinkWrapper>
              )}
              
              {/* Cart - Mobile */}
              {showCart && (
                <LinkWrapper to={`${baseUrl}/cart`}>
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart className="h-5 w-5" style={iconStyle} />
                    {totalCartItems > 0 && (
                      <span
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {totalCartItems}
                      </span>
                    )}
                  </Button>
                </LinkWrapper>
              )}
            </div>
          )}
        </div>
        
        {/* === MOBILE SECONDARY BAR: Search + Featured Promos === */}
        {(forceMobile || !forceDesktop) && (showSearch || (featuredPromosEnabled && featuredPromosUrl)) && (
          <div 
            className={cn(
              "flex items-center py-2 border-t border-muted/30 gap-3 px-1",
              forceDesktop ? "hidden" : (forceMobile ? "flex" : "flex md:hidden"),
              // If only one is enabled, center it
              showSearch && !(featuredPromosEnabled && featuredPromosUrl) ? "justify-center" : "",
              !showSearch && (featuredPromosEnabled && featuredPromosUrl) ? "justify-center" : "",
              showSearch && (featuredPromosEnabled && featuredPromosUrl) ? "justify-between" : ""
            )}
            style={{ 
              backgroundColor: headerBgColor || undefined,
              minHeight: '36px'
            }}
          >
            {/* Search Field - Left side (or centered if alone) */}
            {showSearch && (
              <div className="relative flex-1 max-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={iconStyle} />
                <Input
                  type="search"
                  placeholder="Pesquisar"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-md"
                  style={{ 
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderColor: 'transparent'
                  }}
                />
              </div>
            )}
            
            {/* Featured Promos - Right side (or centered if alone) */}
            {featuredPromosEnabled && featuredPromosUrl && (
              <LinkWrapper
                to={featuredPromosUrl}
                className="text-xs font-bold hover:opacity-80 whitespace-nowrap px-2"
                style={{ color: featuredPromosTextColor }}
              >
                {featuredPromosLabel}
              </LinkWrapper>
            )}
          </div>
        )}
        
        {/* === DESKTOP SECONDARY NAV BAR: Featured Promos (left) + Header Menu Items (center) === */}
        {/* Only render if showHeaderMenu is true AND (menu has items OR featured promos OR editing) */}
        {showHeaderMenu && (forceDesktop || !forceMobile) && (hierarchicalMenuItems.length > 0 || featuredPromosUrl || isEditing) && (
          <nav className={cn(
            "flex items-center py-2 border-t border-muted/30",
            forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
          )}
          style={{ 
            backgroundColor: headerBgColor ? `${headerBgColor}` : undefined,
            minHeight: getNavBarHeight()
          }}
          >
            {/* Featured Promos - LEFT side with thumbnail on hover */}
            <div className="flex-shrink-0">
              {featuredPromosEnabled && featuredPromosUrl && (
                <div 
                  className="relative"
                  onMouseEnter={() => setFeaturedPromoHover(true)}
                  onMouseLeave={() => setFeaturedPromoHover(false)}
                >
                  <LinkWrapper
                    to={featuredPromosUrl}
                    className="text-xs font-bold hover:opacity-90 whitespace-nowrap px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 sf-btn-primary"
                    style={featuredPromosBgColor ? { 
                      color: featuredPromosTextColor || '#ffffff',
                      backgroundColor: featuredPromosBgColor
                    } : {
                      color: featuredPromosTextColor || '#ffffff'
                    }}
                  >
                    {featuredPromosLabel}
                  </LinkWrapper>
                  
                  {/* Thumbnail popup on hover - Desktop only */}
                  {featuredPromoHover && featuredPromosThumbnail && (
                    <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                      <div 
                        className="bg-popover rounded-lg shadow-xl border overflow-hidden"
                        style={{ borderColor: featuredPromosBgColor || 'hsl(var(--border))' }}
                      >
                        <img 
                          src={featuredPromosThumbnail} 
                          alt={featuredPromosLabel}
                          className="w-60 h-24 object-cover"
                        />
                        <div className="p-2 text-center" style={{ backgroundColor: featuredPromosBgColor || undefined }}>
                          <span className="text-xs font-medium text-popover-foreground">{featuredPromosLabel}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Header Menu Items Navigation - Centered */}
            <div className="flex items-center justify-center gap-6 flex-1">
              {hierarchicalMenuItems.length > 0 ? (
                hierarchicalMenuItems.map((item) => (
                item.children.length > 0 ? (
                  <div 
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => handleDropdownEnter(item.id)}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <LinkWrapper
                      to={getMenuItemUrl(item)}
                      className="text-xs font-medium hover:text-primary transition-colors whitespace-nowrap inline-flex items-center gap-1 py-1"
                      style={{ color: headerTextColor || undefined }}
                    >
                      {item.label}
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        openDropdown === item.id && "rotate-180"
                      )} />
                    </LinkWrapper>
                    {openDropdown === item.id && (
                      <div 
                        className={cn(
                          "absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50",
                          // Styles by menuVisualStyle
                          menuVisualStyle === 'classic' && "bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-xl py-2 min-w-[260px] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
                          menuVisualStyle === 'elegant' && "bg-popover border border-border/40 rounded-2xl shadow-2xl py-3 min-w-[280px] animate-in fade-in-0 slide-in-from-top-4 duration-300",
                          menuVisualStyle === 'minimal' && "bg-popover shadow-lg py-2 min-w-[220px] animate-in fade-in-0 duration-150"
                        )}
                        onMouseEnter={() => handleDropdownEnter(item.id)}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {/* Dropdown arrow - only for classic and elegant */}
                        {menuVisualStyle !== 'minimal' && (
                          <div className={cn(
                            "absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45",
                            menuVisualStyle === 'classic' && "bg-popover/95 border-l border-t border-border/60",
                            menuVisualStyle === 'elegant' && "bg-popover border-l border-t border-border/40"
                          )} />
                        )}
                        
                        {/* Menu header - only if menuShowParentTitle is true and not minimal */}
                        {menuShowParentTitle && menuVisualStyle !== 'minimal' && (
                          <div className={cn(
                            "px-4 py-2 border-b mb-1",
                            menuVisualStyle === 'classic' && "border-border/40",
                            menuVisualStyle === 'elegant' && "border-border/30"
                          )}>
                            <span className={cn(
                              "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                              menuVisualStyle === 'elegant' && "text-[11px] tracking-widest"
                            )}>
                              {item.label}
                            </span>
                          </div>
                        )}
                        
                        <div className="relative">
                          {item.children.map((child, index) => (
                            <div key={child.id} className="relative group/submenu">
                              <LinkWrapper
                                to={getMenuItemUrl(child)}
                                className={cn(
                                  "flex items-center justify-between gap-3 text-sm text-popover-foreground transition-all",
                                  // Styles by menuVisualStyle
                                  menuVisualStyle === 'classic' && "px-4 py-2.5 hover:bg-primary/8 hover:text-primary hover:pl-5 duration-150 relative",
                                  menuVisualStyle === 'elegant' && "px-5 py-3 hover:bg-muted/50 hover:text-primary duration-200 relative",
                                  menuVisualStyle === 'minimal' && "px-4 py-2 hover:text-primary duration-100"
                                )}
                              >
                                {/* Left indicator on hover - only for classic */}
                                {menuVisualStyle === 'classic' && (
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 bg-primary rounded-r transition-all duration-200 group-hover/submenu:h-5" />
                                )}
                                
                                {/* Elegant style: subtle left border on hover */}
                                {menuVisualStyle === 'elegant' && (
                                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary scale-y-0 group-hover/submenu:scale-y-100 transition-transform duration-200 origin-center" />
                                )}
                                
                                <span className={cn(
                                  menuVisualStyle === 'classic' && "font-medium",
                                  menuVisualStyle === 'elegant' && "font-normal",
                                  menuVisualStyle === 'minimal' && "font-normal text-[13px]"
                                )}>{child.label}</span>
                                {child.children && child.children.length > 0 && (
                                  <ChevronRight className={cn(
                                    "h-4 w-4 transition-all",
                                    menuVisualStyle === 'classic' && "opacity-40 group-hover/submenu:opacity-100 group-hover/submenu:translate-x-0.5 duration-150",
                                    menuVisualStyle === 'elegant' && "opacity-30 group-hover/submenu:opacity-70 duration-200",
                                    menuVisualStyle === 'minimal' && "opacity-50 h-3 w-3"
                                  )} />
                                )}
                              </LinkWrapper>
                              
                              {/* Sub-submenu (3rd level) */}
                              {child.children && child.children.length > 0 && (
                                <div className={cn(
                                  "absolute left-full top-0 ml-2 z-50 hidden group-hover/submenu:block",
                                  menuVisualStyle === 'classic' && "bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-xl py-2 min-w-[200px] animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-150",
                                  menuVisualStyle === 'elegant' && "bg-popover border border-border/40 rounded-xl shadow-xl py-2 min-w-[200px] animate-in fade-in-0 slide-in-from-left-4 duration-200",
                                  menuVisualStyle === 'minimal' && "bg-popover shadow-md py-1.5 min-w-[180px] animate-in fade-in-0 duration-100"
                                )}>
                                  {/* Submenu header - only for classic/elegant */}
                                  {menuVisualStyle !== 'minimal' && (
                                    <div className="px-3 py-1.5 border-b border-border/40 mb-1">
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        {child.label}
                                      </span>
                                    </div>
                                  )}
                                  {child.children.map((grandchild) => (
                                    <LinkWrapper
                                      key={grandchild.id}
                                      to={getMenuItemUrl(grandchild)}
                                      className={cn(
                                        "group/item flex items-center gap-2 text-sm text-popover-foreground transition-all relative",
                                        menuVisualStyle === 'classic' && "px-3 py-2 hover:bg-primary/8 hover:text-primary duration-150",
                                        menuVisualStyle === 'elegant' && "px-4 py-2.5 hover:bg-muted/50 hover:text-primary duration-200",
                                        menuVisualStyle === 'minimal' && "px-3 py-1.5 hover:text-primary duration-100 text-[13px]"
                                      )}
                                    >
                                      {/* Bullet point - only for classic */}
                                      {menuVisualStyle === 'classic' && (
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30 group-hover/item:bg-primary group-hover/item:scale-125 transition-all" />
                                      )}
                                      <span>{grandchild.label}</span>
                                    </LinkWrapper>
                                  ))}
                                </div>
                              )}
                              
                              {/* Subtle separator between items - only for classic/elegant */}
                              {menuVisualStyle !== 'minimal' && index < item.children.length - 1 && (
                                <div className={cn(
                                  "mx-3 border-b",
                                  menuVisualStyle === 'classic' && "border-border/20",
                                  menuVisualStyle === 'elegant' && "border-border/10"
                                )} />
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Optional footer with "Ver todos" - only for classic/elegant */}
                        {menuVisualStyle !== 'minimal' && (
                          <div className={cn(
                            "px-4 pt-2 mt-1 border-t",
                            menuVisualStyle === 'classic' && "border-border/40",
                            menuVisualStyle === 'elegant' && "border-border/30"
                          )}>
                            <LinkWrapper
                              to={getMenuItemUrl(item)}
                              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors inline-flex items-center gap-1 group"
                            >
                              Ver todos
                              <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </LinkWrapper>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <LinkWrapper
                    key={item.id}
                    to={getMenuItemUrl(item)}
                    className="text-xs font-medium hover:text-primary transition-colors whitespace-nowrap py-1"
                    style={{ color: headerTextColor || undefined }}
                  >
                    {item.label}
                  </LinkWrapper>
                )
              ))
              ) : isEditing ? (
                // Demo menu items when no real menu in editor mode - INTERACTIVE
                <>
                  {/* Demo: Categorias with dropdown */}
                  <div 
                    className="relative"
                    onMouseEnter={() => handleDropdownEnter('demo-categorias')}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <span
                      className="text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1 py-1 transition-colors hover:text-primary"
                      style={{ color: headerTextColor || undefined }}
                    >
                      Categorias
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        openDropdown === 'demo-categorias' && "rotate-180"
                      )} />
                    </span>
                    {openDropdown === 'demo-categorias' && (
                      <div 
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-xl py-2 min-w-[260px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
                        onMouseEnter={() => handleDropdownEnter('demo-categorias')}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {/* Dropdown arrow */}
                        <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-popover/95 border-l border-t border-border/60" />
                        
                        {/* Menu header */}
                        <div className="px-4 py-2 border-b border-border/40 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Categorias
                          </span>
                        </div>
                        
                        <div className="relative">
                          {[
                            { label: 'Masculino', children: ['Camisetas', 'Calças', 'Acessórios'] },
                            { label: 'Feminino', children: ['Vestidos', 'Blusas', 'Saias'] },
                            { label: 'Infantil', children: [] },
                            { label: 'Promoções', children: [] },
                          ].map((item, index, arr) => (
                            <div key={item.label} className="relative group/submenu">
                              <span
                                className={cn(
                                  "flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-popover-foreground transition-all duration-150 cursor-pointer",
                                  "hover:bg-primary/8 hover:text-primary hover:pl-5",
                                  "relative"
                                )}
                              >
                                {/* Left indicator on hover */}
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 bg-primary rounded-r transition-all duration-200 group-hover/submenu:h-5" />
                                
                                <span className="font-medium">{item.label}</span>
                                {item.children.length > 0 && (
                                  <ChevronRight className="h-4 w-4 opacity-40 group-hover/submenu:opacity-100 group-hover/submenu:translate-x-0.5 transition-all duration-150" />
                                )}
                              </span>
                              
                              {/* Sub-submenu (3rd level) */}
                              {item.children.length > 0 && (
                                <div className="absolute left-full top-0 ml-2 bg-popover/95 backdrop-blur-md border border-border/60 rounded-xl shadow-xl py-2 min-w-[180px] z-50 hidden group-hover/submenu:block animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-150">
                                  {/* Submenu header */}
                                  <div className="px-3 py-1.5 border-b border-border/40 mb-1">
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      {item.label}
                                    </span>
                                  </div>
                                  {item.children.map((child) => (
                                    <span
                                      key={child}
                                      className="group/item flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-primary/8 hover:text-primary transition-all duration-150 cursor-pointer"
                                    >
                                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30 group-hover/item:bg-primary group-hover/item:scale-125 transition-all" />
                                      <span>{child}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* Separator */}
                              {index < arr.length - 1 && (
                                <div className="mx-3 border-b border-border/20" />
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Footer */}
                        <div className="px-4 pt-2 mt-1 border-t border-border/40">
                          <span className="text-xs text-primary font-medium inline-flex items-center gap-1 group cursor-pointer hover:text-primary/80 transition-colors">
                            Ver todos
                            <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Demo: Simple menu items */}
                  {['Novidades', 'Promoções', 'Sobre'].map((label) => (
                    <span
                      key={label}
                      className="text-xs font-medium cursor-pointer whitespace-nowrap py-1 transition-colors hover:text-primary"
                      style={{ color: headerTextColor || undefined }}
                    >
                      {label}
                    </span>
                  ))}
                  
                  <span className="text-[10px] text-muted-foreground/50 italic ml-2 px-2 py-0.5 bg-muted/30 rounded">
                    Demo • Configure em Menus
                  </span>
                </>
              ) : null}
            </div>
            
            {/* Spacer to balance the featured promos on left */}
            <div className="flex-shrink-0 w-32" />
          </nav>
        )}
        
        {/* === CHECKOUT-ONLY SECONDARY BAR: Featured Promos + Security Seals === */}
        {/* Shows when header menu is disabled (checkout mode) but featured promos or security seals are enabled */}
        {!showHeaderMenu && (forceDesktop || !forceMobile) && (featuredPromosEnabled || showSecuritySeals) && (
          <div 
            className={cn(
              "flex items-center justify-between py-2 border-t border-muted/30 px-4 gap-4",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
            )}
            style={{ 
              backgroundColor: headerBgColor || undefined,
              minHeight: '40px'
            }}
          >
            {/* Featured Promos - Left side */}
            <div className="flex-shrink-0">
              {featuredPromosEnabled && featuredPromosUrl && (
                <div 
                  className="relative"
                  onMouseEnter={() => setFeaturedPromoHover(true)}
                  onMouseLeave={() => setFeaturedPromoHover(false)}
                >
                  <LinkWrapper
                    to={featuredPromosUrl}
                    className="text-xs font-bold hover:opacity-90 whitespace-nowrap px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 sf-btn-primary"
                    style={featuredPromosBgColor ? { 
                      color: featuredPromosTextColor || '#ffffff',
                      backgroundColor: featuredPromosBgColor
                    } : {
                      color: featuredPromosTextColor || '#ffffff'
                    }}
                  >
                    {featuredPromosLabel}
                  </LinkWrapper>
                  
                  {/* Thumbnail popup on hover */}
                  {featuredPromoHover && featuredPromosThumbnail && (
                    <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                      <div 
                        className="bg-popover rounded-lg shadow-xl border overflow-hidden"
                        style={{ borderColor: featuredPromosBgColor || 'hsl(var(--border))' }}
                      >
                        <img 
                          src={featuredPromosThumbnail} 
                          alt={featuredPromosLabel}
                          className="w-60 h-24 object-cover"
                        />
                        <div className="p-2 text-center" style={{ backgroundColor: featuredPromosBgColor || undefined }}>
                          <span className="text-xs font-medium text-popover-foreground">{featuredPromosLabel}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Placeholder for demo in editing mode when promos enabled but no destination */}
              {featuredPromosEnabled && !featuredPromosUrl && isEditing && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-md sf-btn-primary opacity-60">
                  {featuredPromosLabel || 'Promoções'} <span className="text-[10px] opacity-70">(configure destino)</span>
                </span>
              )}
            </div>
            
            {/* Security Seals - Right side */}
            {showSecuritySeals && (
              <div className="flex items-center gap-2">
                {/* Default security seals icons - theme-aware accent color */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded text-[10px] text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span>SSL Seguro</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded text-[10px] text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>Site Seguro</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded text-[10px] text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
                    </svg>
                    <span>Compra Verificada</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* === MOBILE CHECKOUT BAR: Featured Promos + Security Seals (when menu hidden) === */}
        {!showHeaderMenu && (forceMobile || !forceDesktop) && (featuredPromosEnabled || showSecuritySeals) && (
          <div 
            className={cn(
              "flex flex-col gap-2 py-2 border-t border-muted/30 px-3",
              forceDesktop ? "hidden" : (forceMobile ? "flex" : "flex md:hidden")
            )}
            style={{ backgroundColor: headerBgColor || undefined }}
          >
            {/* Featured Promos */}
            {featuredPromosEnabled && (
              <div className="flex justify-center">
                {featuredPromosUrl ? (
                  <LinkWrapper
                    to={featuredPromosUrl}
                    className="text-xs font-bold hover:opacity-90 whitespace-nowrap px-3 py-1.5 rounded-md sf-btn-primary"
                    style={featuredPromosBgColor ? { 
                      color: featuredPromosTextColor || '#ffffff',
                      backgroundColor: featuredPromosBgColor
                    } : {
                      color: featuredPromosTextColor || '#ffffff'
                    }}
                  >
                    {featuredPromosLabel}
                  </LinkWrapper>
                ) : isEditing ? (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-md sf-btn-primary opacity-60">
                    {featuredPromosLabel || 'Promoções'} <span className="text-[10px] opacity-70">(configure)</span>
                  </span>
                ) : null}
              </div>
            )}
            
            {/* Security Seals - Mobile (theme-aware) */}
            {showSecuritySeals && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/30 rounded text-[9px] text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>SSL</span>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/30 rounded text-[9px] text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span>Seguro</span>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/30 rounded text-[9px] text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
                  </svg>
                  <span>Verificado</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
