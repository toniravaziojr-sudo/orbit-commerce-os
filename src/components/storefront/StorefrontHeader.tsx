import { Link, useParams } from 'react-router-dom';
import { Search, ShoppingCart, Menu, Phone, MessageCircle, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useCart } from '@/hooks/useCart';
import { usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MenuItem } from '@/hooks/useStorefront';
import { cn } from '@/lib/utils';

export function StorefrontHeader() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, headerMenu, categories } = usePublicStorefront(tenantSlug || '');
  const { totalItems } = useCart(tenantSlug || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [animationState, setAnimationState] = useState<'initial' | 'animating' | 'done'>('initial');
  const noticeRef = useRef<HTMLDivElement>(null);

  // Fetch global layout for header config
  const { data: globalLayout } = usePublicGlobalLayout(tenantSlug || '');
  const headerConfig = globalLayout?.header_config?.props || {};

  // Extract header props from global config
  const showSearch = headerConfig.showSearch ?? true;
  const showCart = headerConfig.showCart ?? true;
  const sticky = headerConfig.sticky ?? true;
  const stickyOnMobile = headerConfig.stickyOnMobile ?? true;
  const headerBgColor = String(headerConfig.headerBgColor || '');
  const headerTextColor = String(headerConfig.headerTextColor || '');
  const headerIconColor = String(headerConfig.headerIconColor || '');
  
  // Notice bar props
  const noticeEnabled = Boolean(headerConfig.noticeEnabled);
  const noticeText = String(headerConfig.noticeText || '');
  const noticeBgColor = String(headerConfig.noticeBgColor || '#1e40af');
  const noticeTextColor = String(headerConfig.noticeTextColor || '#ffffff');
  const noticeAnimation = String(headerConfig.noticeAnimation || 'fade');
  const noticeActionEnabled = Boolean(headerConfig.noticeActionEnabled);
  const noticeActionLabel = String(headerConfig.noticeActionLabel || '');
  const noticeActionUrl = String(headerConfig.noticeActionUrl || '');
  const noticeActionTarget = String(headerConfig.noticeActionTarget || '_self') as '_self' | '_blank';
  const noticeActionTextColor = String(headerConfig.noticeActionTextColor || '');
  
  // Contact props
  const showWhatsApp = Boolean(headerConfig.showWhatsApp);
  const whatsAppNumber = String(headerConfig.whatsAppNumber || '');
  const whatsAppLabel = String(headerConfig.whatsAppLabel || '');
  const showPhone = Boolean(headerConfig.showPhone);
  const phoneNumber = String(headerConfig.phoneNumber || '');
  const phoneLabel = String(headerConfig.phoneLabel || '');
  
  // REMOVIDO: Featured category/page props - menu vem do Menu Builder
  
  // Customer area props
  const customerAreaEnabled = Boolean(headerConfig.customerAreaEnabled);
  const customerAreaLabel = String(headerConfig.customerAreaLabel || 'Minhas compras');
  
  // Featured promos props
  const featuredPromosEnabled = Boolean(headerConfig.featuredPromosEnabled);
  const featuredPromosLabel = String(headerConfig.featuredPromosLabel || 'Promoções');
  const featuredPromosTextColor = String(headerConfig.featuredPromosTextColor || '#d97706');
  const featuredPromosPageId = String(headerConfig.featuredPromosPageId || '');

  // Fetch promo page
  const { data: promoPage } = useQuery({
    queryKey: ['storefront-promo-page', featuredPromosPageId],
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

  // REMOVIDO: Fetch featured page (Categoria em Destaque) - menu vem do Menu Builder

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

  const baseUrl = `/store/${tenantSlug}`;
  const menuItems = headerMenu?.items || [];

  const getMenuItemUrl = (item: MenuItem): string => {
    if (item.item_type === 'external' && item.url) {
      return item.url;
    }
    if (item.item_type === 'category' && item.ref_id) {
      const category = categories?.find(c => c.id === item.ref_id);
      return category ? `${baseUrl}/c/${category.slug}` : baseUrl;
    }
    if (item.item_type === 'page' && item.ref_id) {
      return `${baseUrl}/page/${item.ref_id}`;
    }
    return baseUrl;
  };

  const primaryColor = storeSettings?.primary_color || '#6366f1';
  
  // Normalize phone numbers
  const normalizedWhatsApp = whatsAppNumber?.replace(/\D/g, '') || '';
  const isWhatsAppValid = showWhatsApp && normalizedWhatsApp.length >= 10;
  const normalizedPhone = phoneNumber?.replace(/[^\d+]/g, '') || '';
  const isPhoneValid = showPhone && normalizedPhone.length >= 8;
  
  // REMOVIDO: featuredCategory - menu vem do Menu Builder
  
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

  return (
    <header 
      className={cn(
        "z-50 w-full border-b shadow-sm",
        sticky && "sticky top-0",
        stickyOnMobile ? "sticky md:relative" : ""
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
            >
              {noticeActionLabel}
            </a>
          )}
        </div>
      )}

      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to={baseUrl} className="flex items-center gap-2">
            {storeSettings?.logo_url ? (
              <img
                src={storeSettings.logo_url}
                alt={storeSettings?.store_name || 'Loja'}
                className="h-10 max-w-[160px] object-contain"
              />
            ) : (
              <span
                className="text-xl font-bold"
                style={{ color: headerTextColor || primaryColor }}
              >
                {storeSettings?.store_name || 'Loja'}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {/* Menu Items (from Menu Builder) */}
            {menuItems.map((item) => (
              <Link
                key={item.id}
                to={getMenuItemUrl(item)}
                className="text-sm font-medium hover:opacity-70 transition-colors"
                style={{ color: headerTextColor || undefined }}
              >
                {item.label}
              </Link>
            ))}
            
            {/* REMOVIDO: Featured Category/Page - menu vem do Menu Builder */}
            
            {/* Featured Promos */}
            {featuredPromosEnabled && promoPage?.slug && (
              <Link
                to={`${baseUrl}/page/${promoPage.slug}`}
                className="text-sm font-bold hover:opacity-80"
                style={{ color: featuredPromosTextColor }}
              >
                {featuredPromosLabel}
              </Link>
            )}
            
            {/* Customer Area - only render if enabled */}
            {customerAreaEnabled && (
              <Link
                to={`${baseUrl}/minhas-compras`}
                className="text-sm font-medium hover:opacity-70 flex items-center gap-1"
                style={{ color: headerTextColor || undefined }}
              >
                <User className="h-4 w-4" style={iconStyle} />
                {customerAreaLabel}
              </Link>
            )}
          </nav>

          {/* Contact Items */}
          <div className="hidden lg:flex items-center gap-4">
            {isWhatsAppValid && (
              <a
                href={`https://wa.me/${normalizedWhatsApp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm hover:opacity-70"
                style={{ color: headerTextColor || undefined }}
              >
                <MessageCircle className="h-4 w-4" style={iconStyle} />
                <span>{whatsAppLabel || 'WhatsApp'}</span>
              </a>
            )}
            {isPhoneValid && (
              <a
                href={`tel:${normalizedPhone}`}
                className="flex items-center gap-1 text-sm hover:opacity-70"
                style={{ color: headerTextColor || undefined }}
              >
                <Phone className="h-4 w-4" style={iconStyle} />
                <span>{phoneLabel || phoneNumber}</span>
              </a>
            )}
          </div>

          {/* Search */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Buscar produtos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {showCart && (
              <Link to={`${baseUrl}/cart`}>
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" style={iconStyle} />
                  {totalItems > 0 && (
                    <span
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" style={iconStyle} />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Mobile Search */}
                  {showSearch && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        type="search"
                        placeholder="Buscar produtos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  )}

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col gap-2">
                    {/* Menu Items (from Menu Builder) */}
                    {menuItems.map((item) => (
                      <Link
                        key={item.id}
                        to={getMenuItemUrl(item)}
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        {item.label}
                      </Link>
                    ))}
                    
                    {/* REMOVIDO: Featured Category/Page (Mobile) - menu vem do Menu Builder */}
                    
                    {/* Featured Promos (Mobile) */}
                    {featuredPromosEnabled && promoPage?.slug && (
                      <Link
                        to={`${baseUrl}/page/${promoPage.slug}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-2 px-4 text-sm font-bold rounded-lg"
                        style={{ color: featuredPromosTextColor }}
                      >
                        {featuredPromosLabel}
                      </Link>
                    )}
                    
                    {/* Customer Area (Mobile) */}
                    {customerAreaEnabled && (
                      <Link
                        to={`${baseUrl}/minhas-compras`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                      >
                        <User className="h-4 w-4" />
                        {customerAreaLabel}
                      </Link>
                    )}
                    
                    {/* Contact (Mobile) */}
                    {(isWhatsAppValid || isPhoneValid) && (
                      <div className="border-t pt-2 mt-2">
                        {isWhatsAppValid && (
                          <a
                            href={`https://wa.me/${normalizedWhatsApp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            {whatsAppLabel || 'WhatsApp'}
                          </a>
                        )}
                        {isPhoneValid && (
                          <a
                            href={`tel:${normalizedPhone}`}
                            className="py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                          >
                            <Phone className="h-4 w-4 text-blue-600" />
                            {phoneLabel || phoneNumber}
                          </a>
                        )}
                      </div>
                    )}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
