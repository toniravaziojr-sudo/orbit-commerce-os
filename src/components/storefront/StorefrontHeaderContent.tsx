import { Link } from 'react-router-dom';
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
  const noticeBgColor = String(props.noticeBgColor || '#1e40af');
  const noticeTextColor = String(props.noticeTextColor || '#ffffff');
  const noticeAnimation = String(props.noticeAnimation || 'fade');
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
  
  // Featured promos props
  const featuredPromosEnabled = Boolean(props.featuredPromosEnabled);
  const featuredPromosLabel = String(props.featuredPromosLabel || 'Promoções');
  const featuredPromosTextColor = String(props.featuredPromosTextColor || '#d97706');
  const featuredPromosDestination = String(props.featuredPromosTarget || props.featuredPromosDestination || '');
  
  // Social media - from store_settings
  const socialFacebook = storeSettings?.social_facebook || null;
  const socialInstagram = storeSettings?.social_instagram || null;

  // Animation effect for notice bar
  useEffect(() => {
    if (!noticeEnabled) {
      setAnimationState('initial');
      return;
    }
    if (noticeAnimation === 'none') {
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

  // Use centralized URL builder
  const baseUrl = getStoreBaseUrl(tenantSlug || '');

  // Parse featured promos destination to generate URL
  const getFeaturedPromosUrl = (): string | null => {
    if (!featuredPromosDestination || !tenantSlug) return null;
    
    if (featuredPromosDestination.startsWith('category:')) {
      const categorySlug = featuredPromosDestination.replace('category:', '');
      return `${baseUrl}/category/${categorySlug}`;
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

  const primaryColor = storeSettings?.primary_color || '#6366f1';
  
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
  
  // Get animation styles
  const getNoticeAnimationStyles = (): React.CSSProperties => {
    if (noticeAnimation === 'none') return { opacity: 1, transform: 'translateY(0)' };
    const isAnimated = animationState === 'animating' || animationState === 'done';
    const transition = animationState === 'animating' ? 'opacity 250ms ease-out, transform 250ms ease-out' : 'none';
    if (noticeAnimation === 'fade') return { opacity: isAnimated ? 1 : 0, transition };
    if (noticeAnimation === 'slide') return { opacity: isAnimated ? 1 : 0, transform: isAnimated ? 'translateY(0)' : 'translateY(-100%)', transition };
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
      {noticeEnabled && noticeText && (
        <div
          ref={noticeRef}
          className="px-4 py-2 text-center text-sm"
          style={{
            backgroundColor: noticeBgColor,
            color: noticeTextColor,
            ...getNoticeAnimationStyles(),
          }}
        >
          <span>{noticeText}</span>
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
                <SheetContent side="left" className="w-[300px] z-[100]" aria-describedby={undefined}>
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
                                    className="flex-1 py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-l-lg"
                                  >
                                    {item.label}
                                  </LinkWrapper>
                                  <button
                                    type="button"
                                    onClick={() => toggleMobileDropdown(item.id)}
                                    className="py-3 px-3 text-muted-foreground hover:bg-muted rounded-r-lg"
                                    aria-label={openMobileDropdowns.has(item.id) ? 'Fechar submenu' : 'Abrir submenu'}
                                  >
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      openMobileDropdowns.has(item.id) && "rotate-180"
                                    )} />
                                  </button>
                                </div>
                                {openMobileDropdowns.has(item.id) && (
                                  <div className="ml-4 border-l-2 border-primary/30">
                                    {item.children.map((child) => (
                                      <div key={child.id}>
                                        {child.children && child.children.length > 0 ? (
                                          <>
                                            <div className="flex items-center">
                                              <LinkWrapper
                                                to={getMenuItemUrl(child)}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex-1 py-2 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-l-lg transition-colors"
                                              >
                                                {child.label}
                                              </LinkWrapper>
                                              <button
                                                type="button"
                                                onClick={() => toggleMobileDropdown(child.id)}
                                                className="py-2 px-3 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-r-lg transition-colors"
                                                aria-label={openMobileDropdowns.has(child.id) ? 'Fechar submenu' : 'Abrir submenu'}
                                              >
                                                <ChevronDown className={cn(
                                                  "h-3 w-3 transition-transform duration-200",
                                                  openMobileDropdowns.has(child.id) && "rotate-180"
                                                )} />
                                              </button>
                                            </div>
                                            {openMobileDropdowns.has(child.id) && (
                                              <div className="ml-4 border-l-2 border-primary/20">
                                                {child.children.map((grandchild) => (
                                                  <LinkWrapper
                                                    key={grandchild.id}
                                                    to={getMenuItemUrl(grandchild)}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="py-2 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg block transition-colors"
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
                                            className="py-2 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg block transition-colors"
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
                                className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center justify-between"
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
                              className="py-3 px-4 text-sm font-medium text-muted-foreground/50 cursor-default"
                            >
                              {label}
                            </span>
                          ))}
                          <p className="text-xs text-muted-foreground/40 italic px-4 mt-2">
                            [Demo] Configure em Menus
                          </p>
                        </>
                      ) : null}
                      
                      {/* Featured Promos (Mobile) */}
                      {featuredPromosEnabled && featuredPromosUrl && (
                        <LinkWrapper
                          to={featuredPromosUrl}
                          onClick={() => setMobileMenuOpen(false)}
                          className="py-3 px-4 text-sm font-bold rounded-lg"
                          style={{ color: featuredPromosTextColor }}
                        >
                          {featuredPromosLabel}
                        </LinkWrapper>
                      )}
                      
                      {/* Customer Area (Mobile) */}
                      {customerAreaEnabled && (
                        <LinkWrapper
                          to={`${baseUrl}/conta`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center gap-2"
                        >
                          <User className="h-4 w-4" />
                          Minha Conta
                        </LinkWrapper>
                      )}
                    </nav>}

                    {/* Contact Section (Mobile Drawer) */}
                    {(isWhatsAppValid || isPhoneValidFlag || isEmailValid) && (
                      <div className="border-t pt-4 mt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-4">Contato</p>
                        <div className="flex flex-col gap-1">
                          {isWhatsAppValid && whatsAppHref && (
                            <a
                              href={whatsAppHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center gap-3"
                              onClick={handleLinkClick}
                            >
                              <MessageCircle className="h-5 w-5 text-green-600" />
                              WhatsApp
                            </a>
                          )}
                          {isPhoneValidFlag && phoneHref && (
                            <a
                              href={phoneHref}
                              className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center gap-3"
                              onClick={handleLinkClick}
                            >
                              <Phone className="h-5 w-5 text-blue-600" />
                              Telefone
                            </a>
                          )}
                          {isEmailValid && emailHref && (
                            <a
                              href={emailHref}
                              className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center gap-3"
                              onClick={handleLinkClick}
                            >
                              <Mail className="h-5 w-5 text-red-600" />
                              Email
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Social Media Section (Mobile Drawer) */}
                    {(socialFacebook || socialInstagram) && (
                      <div className="border-t pt-4 mt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-4">Redes Sociais</p>
                        <div className="flex gap-4 px-4">
                          {socialFacebook && (
                            <a 
                              href={socialFacebook} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-muted rounded-lg"
                              onClick={handleLinkClick}
                            >
                              <Facebook className="h-6 w-6 text-blue-600" />
                            </a>
                          )}
                          {socialInstagram && (
                            <a 
                              href={socialInstagram} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-muted rounded-lg"
                              onClick={handleLinkClick}
                            >
                              <Instagram className="h-6 w-6 text-pink-600" />
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

          {/* === CENTER REGION: Logo (always centered) === */}
          <LinkWrapper 
            to={baseUrl || '/'} 
            className={cn(
              "flex items-center gap-2 shrink-0",
              // Mobile: centered absolutely
              forceMobile ? "absolute left-1/2 -translate-x-1/2" : 
              // Desktop: centered via flex
              forceDesktop ? "static translate-x-0" : 
              // Responsive: mobile centered, desktop static
              "absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"
            )}
          >
            {storeSettings?.logo_url ? (
              <img
                src={storeSettings.logo_url}
                alt={storeSettings?.store_name || 'Loja'}
                className="h-10 max-w-[140px] md:max-w-[160px] object-contain"
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
              "flex items-center justify-end gap-3 flex-1",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
            )}>
              {/* Attendance Dropdown - Shows demo when no real contact in editor */}
              {(hasContactInfo || isEditing) && (
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
        
        {/* === DESKTOP SECONDARY NAV BAR: Header Menu Items + Featured Promos === */}
        {(forceDesktop || !forceMobile) && (hierarchicalMenuItems.length > 0 || featuredPromosUrl || isEditing) && (
          <nav className={cn(
            "flex items-center justify-center py-2 border-t border-muted/30",
            forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
          )}
          style={{ 
            backgroundColor: headerBgColor ? `${headerBgColor}` : undefined,
            minHeight: '32px'
          }}
          >
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
                      className="text-xs font-medium hover:opacity-70 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                      style={{ color: headerTextColor || undefined }}
                    >
                      {item.label}
                      <ChevronDown className="h-3 w-3" />
                    </LinkWrapper>
                    {openDropdown === item.id && (
                      <div 
                        className="absolute top-full left-0 mt-2 bg-popover border border-primary/20 rounded-lg shadow-xl py-2 min-w-[200px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
                        onMouseEnter={() => handleDropdownEnter(item.id)}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {item.children.map((child, index) => (
                          <div key={child.id} className="relative group/submenu">
                            <LinkWrapper
                              to={getMenuItemUrl(child)}
                              className={cn(
                                "flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-popover-foreground hover:bg-primary/10 hover:text-primary transition-colors",
                                index === 0 && "rounded-t-sm",
                                index === item.children.length - 1 && !child.children?.length && "rounded-b-sm"
                              )}
                            >
                              <span>{child.label}</span>
                              {child.children && child.children.length > 0 && (
                                <ChevronRight className="h-3 w-3 opacity-60" />
                              )}
                            </LinkWrapper>
                            {/* Sub-submenu (3rd level) */}
                            {child.children && child.children.length > 0 && (
                              <div className="absolute left-full top-0 ml-1 bg-popover border border-primary/20 rounded-lg shadow-xl py-2 min-w-[180px] z-50 hidden group-hover/submenu:block animate-in fade-in-0 zoom-in-95 slide-in-from-left-2">
                                {child.children.map((grandchild, gIndex) => (
                                  <LinkWrapper
                                    key={grandchild.id}
                                    to={getMenuItemUrl(grandchild)}
                                    className={cn(
                                      "flex items-center gap-2 px-4 py-2.5 text-sm text-popover-foreground hover:bg-primary/10 hover:text-primary transition-colors",
                                      gIndex === 0 && "rounded-t-sm",
                                      gIndex === child.children.length - 1 && "rounded-b-sm"
                                    )}
                                  >
                                    <span>{grandchild.label}</span>
                                  </LinkWrapper>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <LinkWrapper
                    key={item.id}
                    to={getMenuItemUrl(item)}
                    className="text-xs font-medium hover:opacity-70 transition-colors whitespace-nowrap"
                    style={{ color: headerTextColor || undefined }}
                  >
                    {item.label}
                  </LinkWrapper>
                )
              ))
              ) : isEditing ? (
                // Demo menu items when no real menu in editor mode
                <>
                  {['Categorias', 'Novidades', 'Promoções', 'Sobre'].map((label, i) => (
                    <span
                      key={i}
                      className="text-xs font-medium text-muted-foreground/50 cursor-default whitespace-nowrap"
                      style={{ color: headerTextColor ? `${headerTextColor}80` : undefined }}
                    >
                      {label}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground/40 italic ml-2">
                    [Demo] Configure em Menus
                  </span>
                </>
              ) : null}
            </div>
            
            {/* Featured Promos - Right side */}
            {featuredPromosEnabled && featuredPromosUrl && (
              <LinkWrapper
                to={featuredPromosUrl}
                className="text-xs font-bold hover:opacity-80 ml-4 whitespace-nowrap"
                style={{ color: featuredPromosTextColor }}
              >
                {featuredPromosLabel}
              </LinkWrapper>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
