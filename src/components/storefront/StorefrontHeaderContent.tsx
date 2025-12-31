import { Link } from 'react-router-dom';
import { Search, ShoppingCart, Menu, Phone, MessageCircle, User, Mail, Facebook, Instagram, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildMenuItemUrl, getStoreBaseUrl, getPublicMyOrdersUrl, getPublicPageUrl } from '@/lib/publicUrls';
import { cn } from '@/lib/utils';
import { 
  getWhatsAppHref, 
  getPhoneHref, 
  getEmailHref,
  isValidWhatsApp,
  isValidPhone,
  isValidEmail
} from '@/lib/contactHelpers';

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
  
  // Contact props - with fallback to store_settings
  const showWhatsApp = Boolean(props.showWhatsApp);
  const whatsAppNumber = String(props.whatsAppNumber || storeSettings?.social_whatsapp || '');
  const whatsAppLabel = String(props.whatsAppLabel || '');
  const showPhone = Boolean(props.showPhone);
  const phoneNumber = String(props.phoneNumber || storeSettings?.contact_phone || '');
  const phoneLabel = String(props.phoneLabel || '');
  const showEmail = Boolean(props.showEmail);
  const emailAddress = String(props.emailAddress || storeSettings?.contact_email || '');
  
  // Customer area props
  const customerAreaEnabled = Boolean(props.customerAreaEnabled);
  // Label fixo: apenas ícone no mobile, "Minha Conta" no desktop
  
  // Featured promos props
  const featuredPromosEnabled = Boolean(props.featuredPromosEnabled);
  const featuredPromosLabel = String(props.featuredPromosLabel || 'Promoções');
  const featuredPromosTextColor = String(props.featuredPromosTextColor || '#d97706');
  const featuredPromosPageId = String(props.featuredPromosPageId || '');
  
  // Social media - from store_settings
  const socialFacebook = storeSettings?.social_facebook || null;
  const socialInstagram = storeSettings?.social_instagram || null;

  // Fetch promo page
  const { data: promoPage } = useQuery({
    queryKey: ['header-promo-page', featuredPromosPageId],
    queryFn: async () => {
      if (!featuredPromosPageId) return null;
      const { data } = await supabase
        .from('store_pages')
        .select('slug')
        .eq('id', featuredPromosPageId)
        .maybeSingle();
      return data;
    },
    enabled: !!featuredPromosPageId && featuredPromosEnabled,
  });

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
    
    // DEBUG: Log all menu items to see their parent_id values
    console.log('[StorefrontHeaderContent] menuItems received:', menuItems.map(m => ({
      id: m.id,
      label: m.label,
      parent_id: m.parent_id,
      hasParentId: m.parent_id !== null && m.parent_id !== undefined && m.parent_id !== ''
    })));
    
    const itemMap = new Map<string, MenuItemWithChildren>();
    const rootItems: MenuItemWithChildren[] = [];
    
    // First pass: create all items with empty children arrays
    menuItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });
    
    // Second pass: organize into hierarchy
    menuItems.forEach(item => {
      const itemWithChildren = itemMap.get(item.id)!;
      // Check if item has a parent and the parent exists in our map
      const hasParent = item.parent_id !== null && item.parent_id !== undefined && item.parent_id !== '';
      
      if (hasParent && itemMap.has(item.parent_id!)) {
        // This is a child item - add to parent's children
        itemMap.get(item.parent_id!)!.children.push(itemWithChildren);
      } else {
        // This is a root item (no parent or parent not found)
        rootItems.push(itemWithChildren);
      }
    });
    
    // Sort children by sort_order
    rootItems.forEach(item => {
      item.children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
    
    const result = rootItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    // DEBUG: Log result showing which items have children
    console.log('[StorefrontHeaderContent] hierarchicalMenuItems result:', result.map(r => ({
      label: r.label,
      childrenCount: r.children.length,
      children: r.children.map(c => c.label)
    })));
    
    return result;
  }, [menuItems]);

  // State for dropdown hover
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  
  // Use helper functions for validation
  const whatsAppHref = getWhatsAppHref(whatsAppNumber);
  const phoneHref = getPhoneHref(phoneNumber);
  const emailHref = getEmailHref(emailAddress);
  const isWhatsAppValid = showWhatsApp && isValidWhatsApp(whatsAppNumber);
  const isPhoneValidFlag = showPhone && isValidPhone(phoneNumber);
  const isEmailValid = showEmail && isValidEmail(emailAddress);
  
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
  // If viewportOverride is set, we use it; otherwise we render both and CSS decides
  const forceMobile = viewportOverride === 'mobile' || viewportOverride === 'tablet';
  const forceDesktop = viewportOverride === 'desktop';

  // DEBUG: Log viewport and layout modes
  console.log('[StorefrontHeaderContent] viewportOverride:', viewportOverride, 'forceMobile:', forceMobile, 'forceDesktop:', forceDesktop);

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
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* === MOBILE LAYOUT === */}
          {/* Rendered when viewportOverride forces mobile OR via CSS on real mobile */}
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
                    <nav className="flex flex-col gap-1">
                      {hierarchicalMenuItems.map((item) => (
                        <div key={item.id}>
                          <LinkWrapper
                            to={getMenuItemUrl(item)}
                            onClick={() => setMobileMenuOpen(false)}
                            className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center justify-between"
                          >
                            {item.label}
                            {item.children.length > 0 && (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </LinkWrapper>
                          {/* Show children indented */}
                          {item.children.length > 0 && (
                            <div className="ml-4 border-l-2 border-muted">
                              {item.children.map((child) => (
                                <LinkWrapper
                                  key={child.id}
                                  to={getMenuItemUrl(child)}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="py-2 px-4 text-sm text-muted-foreground hover:bg-muted rounded-lg block"
                                >
                                  {child.label}
                                </LinkWrapper>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Featured Promos (Mobile) */}
                      {featuredPromosEnabled && promoPage?.slug && (
                        <LinkWrapper
                          to={`${baseUrl}/page/${promoPage.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="py-3 px-4 text-sm font-bold rounded-lg"
                          style={{ color: featuredPromosTextColor }}
                        >
                          {featuredPromosLabel}
                        </LinkWrapper>
                      )}
                      
                      {/* Customer Area (Mobile) - Minha Conta */}
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
                    </nav>
                      
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
                              {whatsAppLabel || 'WhatsApp'}
                            </a>
                          )}
                          {isPhoneValidFlag && phoneHref && (
                            <a
                              href={phoneHref}
                              className="py-3 px-4 text-sm font-medium text-foreground hover:bg-muted rounded-lg flex items-center gap-3"
                              onClick={handleLinkClick}
                            >
                              <Phone className="h-5 w-5 text-blue-600" />
                              {phoneLabel || phoneNumber}
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

          {/* Logo - Centered on mobile, left on desktop */}
          <LinkWrapper 
            to={baseUrl || '/'} 
            className={cn(
              "flex items-center gap-2",
              forceMobile ? "absolute left-1/2 -translate-x-1/2" : 
              forceDesktop ? "static translate-x-0" : 
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
                className="text-lg md:text-xl font-bold"
                style={{ color: headerTextColor || primaryColor }}
              >
                {storeSettings?.store_name || 'Loja'}
              </span>
            )}
          </LinkWrapper>

          {/* === DESKTOP NAVIGATION === */}
          {/* Rendered when viewportOverride forces desktop OR via CSS on real desktop */}
          {(forceDesktop || !forceMobile) && (
            <nav className={cn(
              "items-center gap-6",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
            )}>
              {hierarchicalMenuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => item.children.length > 0 && handleDropdownEnter(item.id)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <LinkWrapper
                    to={getMenuItemUrl(item)}
                    className={cn(
                      "text-sm font-medium hover:opacity-70 transition-colors flex items-center gap-1",
                      item.children.length > 0 && "cursor-pointer"
                    )}
                    style={{ color: headerTextColor || undefined }}
                  >
                    {item.label}
                    {item.children.length > 0 && (
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        openDropdown === item.id && "rotate-180"
                      )} />
                    )}
                  </LinkWrapper>
                  
                  {/* Dropdown Menu */}
                  {item.children.length > 0 && openDropdown === item.id && (
                    <div 
                      className="absolute top-full left-0 mt-1 py-2 min-w-[200px] bg-background border rounded-lg shadow-lg z-50"
                      onMouseEnter={() => handleDropdownEnter(item.id)}
                      onMouseLeave={handleDropdownLeave}
                    >
                      {item.children.map((child) => (
                        <LinkWrapper
                          key={child.id}
                          to={getMenuItemUrl(child)}
                          className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          {child.label}
                        </LinkWrapper>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Featured Promos */}
              {featuredPromosEnabled && promoPage?.slug && (
                <LinkWrapper
                  to={`${baseUrl}/page/${promoPage.slug}`}
                  className="text-sm font-bold hover:opacity-80"
                  style={{ color: featuredPromosTextColor }}
                >
                  {featuredPromosLabel}
                </LinkWrapper>
              )}
              
              {/* Customer Area - Desktop: texto "Minha Conta" */}
              {customerAreaEnabled && (
                <LinkWrapper
                  to={`${baseUrl}/conta`}
                  className="text-sm font-medium hover:opacity-70 flex items-center gap-1"
                  style={{ color: headerTextColor || undefined }}
                >
                  <User className="h-4 w-4" style={iconStyle} />
                  Minha Conta
                </LinkWrapper>
              )}
            </nav>
          )}

          {/* Contact Items - Desktop only */}
          {(forceDesktop || !forceMobile) && (
            <div className={cn(
              "items-center gap-4",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden lg:flex")
            )}>
              {isWhatsAppValid && whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm hover:opacity-70"
                  style={{ color: headerTextColor || undefined }}
                  onClick={handleLinkClick}
                >
                  <MessageCircle className="h-4 w-4" style={iconStyle} />
                  <span>{whatsAppLabel || 'WhatsApp'}</span>
                </a>
              )}
              {isPhoneValidFlag && phoneHref && (
                <a
                  href={phoneHref}
                  className="flex items-center gap-1 text-sm hover:opacity-70"
                  style={{ color: headerTextColor || undefined }}
                  onClick={handleLinkClick}
                >
                  <Phone className="h-4 w-4" style={iconStyle} />
                  <span>{phoneLabel || phoneNumber}</span>
                </a>
              )}
              {isEmailValid && emailHref && (
                <a
                  href={emailHref}
                  className="flex items-center gap-1 text-sm hover:opacity-70"
                  style={{ color: headerTextColor || undefined }}
                  onClick={handleLinkClick}
                >
                  <Mail className="h-4 w-4" style={iconStyle} />
                  <span>Email</span>
                </a>
              )}
              {/* Social Media Icons */}
              {socialFacebook && (
                <a
                  href={socialFacebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70"
                  onClick={handleLinkClick}
                >
                  <Facebook className="h-4 w-4" style={iconStyle} />
                </a>
              )}
              {socialInstagram && (
                <a
                  href={socialInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70"
                  onClick={handleLinkClick}
                >
                  <Instagram className="h-4 w-4" style={iconStyle} />
                </a>
              )}
            </div>
          )}

          {/* Desktop Search */}
          {showSearch && (forceDesktop || !forceMobile) && (
            <div className={cn(
              "flex-1 max-w-md",
              forceMobile ? "hidden" : (forceDesktop ? "flex" : "hidden md:flex")
            )}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
            </div>
          )}

          {/* Actions - Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile search icon (opens dialog) - only on mobile */}
            {showSearch && (forceMobile || !forceDesktop) && (
              <Button 
                variant="ghost" 
                size="icon"
                className={cn(
                  forceDesktop ? "hidden" : (forceMobile ? "flex" : "flex md:hidden")
                )}
              >
                <Search className="h-5 w-5" style={iconStyle} />
              </Button>
            )}
            
            {/* Customer area icon - Minha Conta */}
            {customerAreaEnabled && (forceMobile || !forceDesktop) && (
              <LinkWrapper 
                to={`${baseUrl}/conta`}
                className={cn(
                  forceDesktop ? "hidden" : (forceMobile ? "block" : "block md:hidden")
                )}
              >
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" style={iconStyle} />
                </Button>
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
        </div>
      </div>
    </header>
  );
}
