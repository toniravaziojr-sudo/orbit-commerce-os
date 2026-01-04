import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Phone, Mail, Youtube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStoreBaseUrl, getPublicCategoryUrl, getPublicPageUrl, getPublicLandingUrl } from '@/lib/publicUrls';
import { getWhatsAppHref, getPhoneHref, getEmailHref, isValidWhatsApp, isValidPhone, isValidEmail } from '@/lib/contactHelpers';
import type { BlockNode } from '@/lib/builder/types';

// TikTok icon component (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

interface MenuItem {
  id: string;
  label: string;
  url?: string | null;
  item_type: string;
  ref_id?: string | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

/**
 * Store Settings interface matching current database schema
 */
interface StoreSettingsData {
  store_name: string | null;
  store_description: string | null;
  logo_url: string | null;
  primary_color: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  social_custom: Array<{ label: string; url: string; icon?: string }> | null;
  business_legal_name: string | null;
  business_cnpj: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  contact_support_hours: string | null;
}

interface StorefrontFooterContentProps {
  tenantSlug: string;
  /** Footer config from global layout - has PRIORITY over store_settings */
  footerConfig?: BlockNode | null;
  isEditing?: boolean;
}

/**
 * StorefrontFooterContent - Single source of truth for footer rendering
 * 
 * Data priority:
 * 1. footerConfig (from storefront_global_layout) - when defined
 * 2. store_settings - fallback for all fields
 * 
 * If footer is disabled (toggle OFF), parent should not render this component.
 */
export function StorefrontFooterContent({ 
  tenantSlug, 
  footerConfig,
  isEditing = false 
}: StorefrontFooterContentProps) {
  // Fetch store settings as fallback data source
  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings-footer', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return null;
      
      const { data } = await supabase
        .from('store_settings')
        .select(`
          store_name,
          store_description,
          logo_url,
          primary_color,
          social_facebook,
          social_instagram,
          social_whatsapp,
          social_tiktok,
          social_youtube,
          social_custom,
          business_legal_name,
          business_cnpj,
          contact_phone,
          contact_email,
          contact_address,
          contact_support_hours
        `)
        .eq('tenant_id', tenant.id)
        .single();
      
      return data as StoreSettingsData | null;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch categories for footer links
  const { data: categories } = useQuery({
    queryKey: ['categories-footer', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return [];
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return [];
      
      const { data } = await supabase
        .from('categories')
        .select('id, slug, name')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order')
        .limit(5);
      
      return data || [];
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch footer menus (footer_1 and footer_2)
  const { data: footerMenus } = useQuery({
    queryKey: ['footer-menus', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return { footer1: null, footer2: null };
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return { footer1: null, footer2: null };
      
      // Fetch all footer menus
      const { data: menus } = await supabase
        .from('menus')
        .select('id, name, location')
        .eq('tenant_id', tenant.id)
        .in('location', ['footer', 'footer_1', 'footer_2']);
      
      if (!menus || menus.length === 0) return { footer1: null, footer2: null };
      
      // Find footer_1 (or legacy 'footer') and footer_2
      const footer1Menu = menus.find(m => m.location === 'footer_1' || m.location === 'footer');
      const footer2Menu = menus.find(m => m.location === 'footer_2');
      
      // Fetch items for each menu
      const fetchItems = async (menuId: string | undefined) => {
        if (!menuId) return [];
        const { data: items } = await supabase
          .from('menu_items')
          .select('id, label, url, item_type, ref_id')
          .eq('menu_id', menuId)
          .order('sort_order');
        return items || [];
      };
      
      const [footer1Items, footer2Items] = await Promise.all([
        fetchItems(footer1Menu?.id),
        fetchItems(footer2Menu?.id),
      ]);
      
      return {
        footer1: footer1Menu ? { name: footer1Menu.name, items: footer1Items } : null,
        footer2: footer2Menu ? { name: footer2Menu.name, items: footer2Items } : null,
      };
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch pages for resolving page menu item URLs
  const { data: pagesData } = useQuery({
    queryKey: ['storefront-pages-footer', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return [];
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return [];
      
      const { data } = await supabase
        .from('store_pages')
        .select('id, slug, type')
        .eq('tenant_id', tenant.id)
        .eq('is_published', true);
      
      return data || [];
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5,
  });

  const baseUrl = getStoreBaseUrl(tenantSlug);
  const footer1Items: MenuItem[] = footerMenus?.footer1?.items || [];
  const footer2Items: MenuItem[] = footerMenus?.footer2?.items || [];
  const footer1Name = footerMenus?.footer1?.name || 'Menu';
  const footer2Name = footerMenus?.footer2?.name || 'Políticas';

  // Helper to resolve menu item URLs (supports 'link' as fallback for 'external')
  const getMenuItemUrl = (item: MenuItem): string => {
    const itemType = item.item_type === 'link' ? 'external' : item.item_type;
    
    if (itemType === 'external' && item.url) {
      return item.url;
    }
    if (itemType === 'category' && item.ref_id) {
      const category = categories?.find((c: Category) => c.id === item.ref_id);
      return category ? getPublicCategoryUrl(tenantSlug, category.slug) || baseUrl : baseUrl;
    }
    if (itemType === 'page' && item.ref_id) {
      const page = pagesData?.find(p => p.id === item.ref_id);
      if (page) {
        const urlFn = page.type === 'landing_page' ? getPublicLandingUrl : getPublicPageUrl;
        return urlFn(tenantSlug, page.slug) || baseUrl;
      }
      return baseUrl;
    }
    return baseUrl;
  };

  // ============================================
  // DATA RESOLUTION: footerConfig > store_settings
  // ============================================
  const configProps = (footerConfig?.props || {}) as Record<string, unknown>;
  
  // Type-safe helper to get string value
  const getString = (configKey: string, settingsValue: string | null | undefined, fallback: string | null = null): string | null => {
    const configValue = configProps[configKey];
    if (typeof configValue === 'string' && configValue) return configValue;
    return settingsValue || fallback;
  };
  
  // Type-safe helper to get boolean value (default true unless explicitly false)
  const getBoolean = (configKey: string, defaultValue: boolean = true): boolean => {
    const configValue = configProps[configKey];
    if (typeof configValue === 'boolean') return configValue;
    return defaultValue;
  };
  
  // ============================================
  // SECTION TOGGLES (from footerConfig)
  // ============================================
  const showLogo = getBoolean('showLogo', true);
  const showSac = getBoolean('showSac', true);
  const showSocial = getBoolean('showSocial', true);
  const showLegal = getBoolean('showLegal', true);
  
  // ============================================
  // CONTENT OVERRIDES
  // ============================================
  const sacTitle = getString('sacTitle', null, 'Atendimento (SAC)') || 'Atendimento (SAC)';
  const legalTextOverride = getString('legalTextOverride', null, '');
  
  // ============================================
  // STYLE
  // ============================================
  const footerBgColor = getString('footerBgColor', null);
  const footerTextColor = getString('footerTextColor', null);
  
  // Primary color: config > settings > default
  const primaryColor = getString('primaryColor', storeSettings?.primary_color, '#6366f1') || '#6366f1';
  
  // Contact info: config > store_settings
  const whatsApp = getString('whatsApp', storeSettings?.social_whatsapp);
  const phone = getString('phone', storeSettings?.contact_phone);
  const email = getString('email', storeSettings?.contact_email);
  const supportHours = getString('supportHours', storeSettings?.contact_support_hours);
  const address = getString('address', storeSettings?.contact_address);
  
  // Business info: config > store_settings
  const storeName = getString('storeName', storeSettings?.store_name, 'Loja') || 'Loja';
  const storeDescription = getString('storeDescription', storeSettings?.store_description);
  const legalName = getString('legalName', storeSettings?.business_legal_name);
  const cnpj = getString('cnpj', storeSettings?.business_cnpj);
  const logoUrl = getString('logoUrl', storeSettings?.logo_url);
  
  // Social media: config > store_settings
  const socialFacebook = getString('socialFacebook', storeSettings?.social_facebook);
  const socialInstagram = getString('socialInstagram', storeSettings?.social_instagram);
  const socialTiktok = getString('socialTiktok', storeSettings?.social_tiktok);
  const socialYoutube = getString('socialYoutube', storeSettings?.social_youtube);
  
  // Social custom array: config > store_settings
  const configSocialCustom = configProps.socialCustom;
  const socialCustom: Array<{ label: string; url: string }> = 
    Array.isArray(configSocialCustom) ? configSocialCustom : 
    (storeSettings?.social_custom || []);
  
  // Generate contact hrefs using helpers
  const whatsAppHref = getWhatsAppHref(whatsApp);
  const phoneHref = getPhoneHref(phone);
  const emailHref = getEmailHref(email);
  
  // Computed flags
  const hasContact = isValidWhatsApp(whatsApp) || isValidPhone(phone) || isValidEmail(email);
  const hasSocialMedia = socialFacebook || socialInstagram || socialTiktok || socialYoutube || 
    (socialCustom && socialCustom.length > 0);

  // ============================================
  // IMAGE SECTIONS (payment, security, shipping, stores)
  // ============================================
  interface ImageSectionItem {
    imageUrl: string;
    linkUrl?: string;
  }
  interface ImageSectionData {
    title: string;
    items: ImageSectionItem[];
  }
  
  const getImageSection = (key: string, defaultTitle: string): ImageSectionData => {
    const sectionData = configProps[key] as ImageSectionData | undefined;
    if (sectionData && typeof sectionData === 'object' && Array.isArray(sectionData.items)) {
      return {
        title: sectionData.title || defaultTitle,
        items: sectionData.items.filter((item: ImageSectionItem) => item?.imageUrl),
      };
    }
    return { title: defaultTitle, items: [] };
  };

  const paymentMethods = getImageSection('paymentMethods', 'Formas de Pagamento');
  const securitySeals = getImageSection('securitySeals', 'Selos de Segurança');
  const shippingMethods = getImageSection('shippingMethods', 'Formas de Envio');
  const officialStores = getImageSection('officialStores', 'Lojas Oficiais');

  const hasImageSections = 
    paymentMethods.items.length > 0 || 
    securitySeals.items.length > 0 || 
    shippingMethods.items.length > 0 || 
    officialStores.items.length > 0;

  // Footer custom styles
  const footerStyle: React.CSSProperties = {
    ...(footerBgColor ? { backgroundColor: footerBgColor } : {}),
    ...(footerTextColor ? { color: footerTextColor } : {}),
  };

  return (
    <footer 
      className="border-t bg-muted/30"
      style={footerStyle}
    >
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Logo - First item, centered (respects showLogo toggle) */}
        {showLogo && (
          <div className="flex justify-center mb-6 md:mb-8">
            <Link to={baseUrl} onClick={e => isEditing && e.preventDefault()}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-10 md:h-12 max-w-[160px] md:max-w-[200px] object-contain"
                />
              ) : (
                <span
                  className="text-xl md:text-2xl font-bold"
                  style={{ color: footerTextColor || primaryColor }}
                >
                  {storeName}
                </span>
              )}
            </Link>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {/* Atendimento (SAC) - respects showSac toggle */}
          {showSac && hasContact && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold mb-4" style={footerTextColor ? { color: footerTextColor } : {}}>
                {sacTitle}
              </h4>
              <div className="flex flex-col gap-3">
                {whatsAppHref && (
                  <a
                    href={whatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 justify-center md:justify-start"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                  >
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {phoneHref && (
                  <a
                    href={phoneHref}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 justify-center md:justify-start"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                  >
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>{phone}</span>
                  </a>
                )}
                {emailHref && (
                  <a
                    href={emailHref}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 justify-center md:justify-start"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                  >
                    <Mail className="h-4 w-4 text-red-600" />
                    <span>{email}</span>
                  </a>
                )}
                {supportHours && (
                  <p className="text-sm text-muted-foreground mt-2" style={footerTextColor ? { color: footerTextColor, opacity: 0.7 } : {}}>
                    {supportHours}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer Menu 1 Links */}
          {footer1Items.length > 0 && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold mb-4" style={footerTextColor ? { color: footerTextColor } : {}}>{footer1Name}</h4>
              <nav className="flex flex-col gap-2">
                {footer1Items.map((item) => (
                  <Link
                    key={item.id}
                    to={getMenuItemUrl(item)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
          
          {/* Footer Menu 2 Links */}
          {footer2Items.length > 0 && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold mb-4" style={footerTextColor ? { color: footerTextColor } : {}}>{footer2Name}</h4>
              <nav className="flex flex-col gap-2">
                {footer2Items.map((item) => (
                  <Link
                    key={item.id}
                    to={getMenuItemUrl(item)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Categories */}
          {categories && categories.length > 0 && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold mb-4" style={footerTextColor ? { color: footerTextColor } : {}}>Categorias</h4>
              <nav className="flex flex-col gap-2">
                {categories.map((category: Category) => (
                  <Link
                    key={category.id}
                    to={getPublicCategoryUrl(tenantSlug, category.slug) || baseUrl}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                  >
                    {category.name}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Social Media - respects showSocial toggle */}
          {showSocial && hasSocialMedia && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold mb-4" style={footerTextColor ? { color: footerTextColor } : {}}>Redes Sociais</h4>
              <div className="flex gap-4 justify-center md:justify-start">
                {socialFacebook && (
                  <a
                    href={socialFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-blue-600 transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor } : {}}
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                )}
                {socialInstagram && (
                  <a
                    href={socialInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-pink-600 transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor } : {}}
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {socialTiktok && (
                  <a
                    href={socialTiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor } : {}}
                  >
                    <TikTokIcon className="h-5 w-5" />
                  </a>
                )}
                {socialYoutube && (
                  <a
                    href={socialYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-red-600 transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor } : {}}
                  >
                    <Youtube className="h-5 w-5" />
                  </a>
                )}
                {/* Custom social links */}
                {socialCustom && socialCustom.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    title={social.label}
                    onClick={e => isEditing && e.preventDefault()}
                    style={footerTextColor ? { color: footerTextColor } : {}}
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image Sections: Payment, Security, Shipping, Official Stores */}
        {hasImageSections && (
          <div className="border-t mt-6 md:mt-8 pt-6 md:pt-8 space-y-6">
            {/* Payment Methods */}
            {paymentMethods.items.length > 0 && (
              <div className="text-center">
                <h4 
                  className="text-sm font-medium text-muted-foreground mb-3"
                  style={footerTextColor ? { color: footerTextColor } : {}}
                >
                  {paymentMethods.title}
                </h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {paymentMethods.items.map((item, index) => (
                    <img
                      key={index}
                      src={item.imageUrl}
                      alt={`Pagamento ${index + 1}`}
                      className="h-6 md:h-8 w-auto object-contain"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Security Seals */}
            {securitySeals.items.length > 0 && (
              <div className="text-center">
                <h4 
                  className="text-sm font-medium text-muted-foreground mb-3"
                  style={footerTextColor ? { color: footerTextColor } : {}}
                >
                  {securitySeals.title}
                </h4>
                <div className="flex flex-wrap justify-center gap-3">
                  {securitySeals.items.map((item, index) => 
                    item.linkUrl ? (
                      <a
                        key={index}
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => isEditing && e.preventDefault()}
                      >
                        <img
                          src={item.imageUrl}
                          alt={`Selo ${index + 1}`}
                          className="h-10 md:h-12 w-auto object-contain"
                        />
                      </a>
                    ) : (
                      <img
                        key={index}
                        src={item.imageUrl}
                        alt={`Selo ${index + 1}`}
                        className="h-10 md:h-12 w-auto object-contain"
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Shipping Methods */}
            {shippingMethods.items.length > 0 && (
              <div className="text-center">
                <h4 
                  className="text-sm font-medium text-muted-foreground mb-3"
                  style={footerTextColor ? { color: footerTextColor } : {}}
                >
                  {shippingMethods.title}
                </h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {shippingMethods.items.map((item, index) => (
                    <img
                      key={index}
                      src={item.imageUrl}
                      alt={`Envio ${index + 1}`}
                      className="h-6 md:h-8 w-auto object-contain"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Official Stores */}
            {officialStores.items.length > 0 && (
              <div className="text-center">
                <h4 
                  className="text-sm font-medium text-muted-foreground mb-3"
                  style={footerTextColor ? { color: footerTextColor } : {}}
                >
                  {officialStores.title}
                </h4>
                <div className="flex flex-wrap justify-center gap-3">
                  {officialStores.items.map((item, index) => (
                    <a
                      key={index}
                      href={item.linkUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => isEditing && e.preventDefault()}
                    >
                      <img
                        src={item.imageUrl}
                        alt={`Loja ${index + 1}`}
                        className="h-8 md:h-10 w-auto object-contain hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legal info / Copyright - respects showLegal toggle */}
        {showLegal && (
          <div className="border-t mt-6 md:mt-8 pt-6 md:pt-8 text-center">
            {/* Custom legal text override OR default content */}
            {legalTextOverride ? (
              <p className="text-sm text-muted-foreground" style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}>
                {legalTextOverride}
              </p>
            ) : (
              <>
                {/* Store description */}
                {storeDescription && (
                  <p className="text-sm text-muted-foreground mb-4 max-w-2xl mx-auto" style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}>
                    {storeDescription}
                  </p>
                )}
                
                {/* Business info */}
                <div className="text-xs text-muted-foreground space-y-1 mb-4" style={footerTextColor ? { color: footerTextColor, opacity: 0.7 } : {}}>
                  {legalName && <p>{legalName}</p>}
                  {cnpj && <p>CNPJ: {cnpj}</p>}
                  {address && <p>{address}</p>}
                </div>
                
                {/* Copyright */}
                <p className="text-sm text-muted-foreground" style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}>
                  © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
