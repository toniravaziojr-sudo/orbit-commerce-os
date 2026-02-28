import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Phone, Mail, Youtube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStoreBaseUrl, getPublicCategoryUrl, getPublicPageUrl, getPublicLandingUrl } from '@/lib/publicUrls';
import { getWhatsAppHref, getPhoneHref, getEmailHref, isValidWhatsApp, isValidPhone, isValidEmail } from '@/lib/contactHelpers';
import { formatCnpj } from '@/lib/formatCnpj';
import { cn } from '@/lib/utils';
import type { BlockNode } from '@/lib/builder/types';
import { FooterNewsletterForm } from './footer/FooterNewsletterForm';
import { paymentSvgPresets, securitySvgPresets, svgToDataUri } from '@/lib/builder/svg-presets';
import { getLogoImageUrl } from '@/lib/imageTransform';

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
  /** Visibility override for footer menu 1 (passed from PublicTemplateRenderer) */
  showFooter1Override?: boolean;
  /** Visibility override for footer menu 2 (passed from PublicTemplateRenderer) */
  showFooter2Override?: boolean;
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
  isEditing = false,
  showFooter1Override,
  showFooter2Override,
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
        .order('sort_order');
      
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
  // Footer menu titles: config override > menu name > default
  const footerConfigProps = (footerConfig?.props || {}) as Record<string, unknown>;
  const footer1TitleConfig = typeof footerConfigProps.footer1Title === 'string' ? footerConfigProps.footer1Title : '';
  const footer2TitleConfig = typeof footerConfigProps.footer2Title === 'string' ? footerConfigProps.footer2Title : '';
  const footer1Name = footer1TitleConfig || footerMenus?.footer1?.name || 'Menu';
  const footer2Name = footer2TitleConfig || footerMenus?.footer2?.name || 'Políticas';

  // Helper to resolve menu item URLs (supports 'link' as fallback for 'external')
  // Returns null if the link cannot be properly resolved (e.g., missing ref_id for page/category)
  const getMenuItemUrl = (item: MenuItem): string | null => {
    const itemType = item.item_type === 'link' ? 'external' : item.item_type;
    
    // External links - require valid URL
    if (itemType === 'external') {
      return item.url || null;
    }
    
    // Category links - require ref_id and matching category
    if (itemType === 'category') {
      if (!item.ref_id) return null;
      const category = categories?.find((c: Category) => c.id === item.ref_id);
      if (!category) return null;
      return getPublicCategoryUrl(tenantSlug, category.slug) || null;
    }
    
    // Page links - require ref_id and matching page
    if (itemType === 'page') {
      if (!item.ref_id) return null;
      const page = pagesData?.find(p => p.id === item.ref_id);
      if (!page) return null;
      const urlFn = page.type === 'landing_page' ? getPublicLandingUrl : getPublicPageUrl;
      return urlFn(tenantSlug, page.slug) || null;
    }
    
    // Blog - standard route
    if (itemType === 'blog') {
      return `${baseUrl}/blog`;
    }
    
    // Tracking - standard route
    if (itemType === 'tracking') {
      return `${baseUrl}/rastreio`;
    }
    
    return null;
  };
  
  // Filter menu items to only those with valid URLs
  const getValidMenuItems = (items: MenuItem[]): Array<MenuItem & { resolvedUrl: string }> => {
    return items
      .map(item => ({ ...item, resolvedUrl: getMenuItemUrl(item) }))
      .filter((item): item is MenuItem & { resolvedUrl: string } => item.resolvedUrl !== null);
  };
  
  const validFooter1Items = getValidMenuItems(footer1Items);
  const validFooter2Items = getValidMenuItems(footer2Items);
  
  // Calculate hidden items count for warnings (shown in editing mode)
  const footer1HiddenCount = footer1Items.length - validFooter1Items.length;
  const footer2HiddenCount = footer2Items.length - validFooter2Items.length;

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
  const showStoreInfo = getBoolean('showStoreInfo', true);
  const showCopyright = getBoolean('showCopyright', true);
  // Legacy: showLegal is now split into showStoreInfo + showCopyright
  // Keep for backwards compatibility
  const showLegal = getBoolean('showLegal', true);
  
  // Image sections visibility toggles
  const showPaymentMethods = getBoolean('showPaymentMethods', true);
  const showSecuritySeals = getBoolean('showSecuritySeals', true);
  
  // Footer menu visibility
  // Priority: props passed by PublicTemplateRenderer > footerConfig > default true
  const showFooter1 = showFooter1Override !== undefined 
    ? showFooter1Override 
    : getBoolean('showFooter1', true);
  const showFooter2 = showFooter2Override !== undefined 
    ? showFooter2Override 
    : getBoolean('showFooter2', true);
  
  // ============================================
  // CONTENT OVERRIDES
  // ============================================
  const sacTitle = getString('sacTitle', null, 'Atendimento (SAC)') || 'Atendimento (SAC)';
  const footer1TitleOverride = getString('footer1Title', null, '');
  const footer2TitleOverride = getString('footer2Title', null, '');
  const copyrightTextOverride = getString('copyrightText', null, '');
  // Legacy support
  const legalTextOverride = copyrightTextOverride || getString('legalTextOverride', null, '');
  
  // ============================================
  // STYLE
  // ============================================
  const footerBgColor = getString('footerBgColor', null);
  const footerTextColor = getString('footerTextColor', null);
  const footerTitlesColor = getString('footerTitlesColor', null) || footerTextColor;
  
  // Menu visual style: classic, elegant, minimal
  const menuVisualStyle = (configProps.menuVisualStyle as 'classic' | 'elegant' | 'minimal') || 'classic';
  
  // Badge size for footer seals/icons: small, medium, large
  const badgeSize = (configProps.badgeSize as 'small' | 'medium' | 'large') || 'medium';
  
  // Badge size classes mapping - UNIFIED across all badge types
  // UPDATED 2026-02-02: Standardized all badge sections with payment methods 30% smaller
  // Reference dimensions for uploads:
  // - Pequeno: 24px altura (mobile) / 32px altura (desktop) 
  // - Médio: 32px altura (mobile) / 40px altura (desktop)
  // - Grande: 40px altura (mobile) / 48px altura (desktop)
  // Payment methods are 30% smaller for visual balance
  const badgeSizeClasses = {
    small: 'h-6 md:h-8',   // 24px / 32px
    medium: 'h-8 md:h-10', // 32px / 40px
    large: 'h-10 md:h-12', // 40px / 48px
  };
  
  // Payment badges are 30% smaller to balance with other seal types
  // Pequeno: 17px/22px, Médio: 22px/28px, Grande: 28px/34px (approx)
  const paymentBadgeSizeClasses = {
    small: 'h-[17px] md:h-[22px]',
    medium: 'h-[22px] md:h-7',
    large: 'h-7 md:h-[34px]',
  };
  
  // Primary color: config > settings > theme default (neutral, not blue)
  const primaryColor = getString('primaryColor', storeSettings?.primary_color, '#1a1a1a') || '#1a1a1a';
  
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
  
  // Default payment methods presets (when no custom items configured)
  const defaultPaymentItems: ImageSectionItem[] = paymentSvgPresets
    .slice(0, 6) // Show first 6 payment methods by default
    .map(preset => ({ imageUrl: svgToDataUri(preset.svg) }));
  
  // Default security seals presets (when no custom items configured)
  const defaultSecurityItems: ImageSectionItem[] = securitySvgPresets
    .slice(0, 4) // Show first 4 security seals by default
    .map(preset => ({ imageUrl: svgToDataUri(preset.svg) }));

  const getImageSection = (key: string, defaultTitle: string, defaultItems: ImageSectionItem[] = []): ImageSectionData => {
    const sectionData = configProps[key] as ImageSectionData | undefined;
    if (sectionData && typeof sectionData === 'object' && Array.isArray(sectionData.items)) {
      const filteredItems = sectionData.items.filter((item: ImageSectionItem) => item?.imageUrl);
      // If items configured but empty array, return defaults
      if (filteredItems.length === 0 && defaultItems.length > 0) {
        return { title: sectionData.title || defaultTitle, items: defaultItems };
      }
      return {
        title: sectionData.title || defaultTitle,
        items: filteredItems,
      };
    }
    // No config at all - use defaults
    return { title: defaultTitle, items: defaultItems };
  };

  const paymentMethods = getImageSection('paymentMethods', 'Formas de Pagamento', defaultPaymentItems);
  const securitySeals = getImageSection('securitySeals', 'Selos de Segurança', defaultSecurityItems);
  const shippingMethods = getImageSection('shippingMethods', 'Formas de Envio');
  const officialStores = getImageSection('officialStores', 'Lojas Oficiais');

  const hasImageSections = 
    (showPaymentMethods && paymentMethods.items.length > 0) || 
    (showSecuritySeals && securitySeals.items.length > 0) || 
    shippingMethods.items.length > 0 || 
    officialStores.items.length > 0;

  // ============================================
  // NEWSLETTER CONFIG
  // ============================================
  const showNewsletter = getBoolean('showNewsletter', false);
  const newsletterTitle = getString('newsletterTitle', null, 'Receba nossas promoções') || 'Receba nossas promoções';
  const newsletterSubtitle = getString('newsletterSubtitle', null, 'Inscreva-se para receber descontos exclusivos direto no seu e-mail!');
  const newsletterPlaceholder = getString('newsletterPlaceholder', null, 'Seu e-mail') || 'Seu e-mail';
  const newsletterButtonText = getString('newsletterButtonText', null, '');
  const newsletterSuccessMessage = getString('newsletterSuccessMessage', null, 'Inscrito com sucesso!') || 'Inscrito com sucesso!';
  const newsletterListId = getString('newsletterListId', null, '');

  // Fetch tenant_id for newsletter form
  const { data: tenantData } = useQuery({
    queryKey: ['tenant-id-footer', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      return tenant;
    },
    enabled: !!tenantSlug && showNewsletter,
    staleTime: 1000 * 60 * 30,
  });
  const tenantId = tenantData?.id;

  // Footer custom styles
  const footerStyle: React.CSSProperties = {
    ...(footerBgColor ? { backgroundColor: footerBgColor } : {}),
    ...(footerTextColor ? { color: footerTextColor } : {}),
  };

  // Helper: Get link class based on menuVisualStyle
  // - classic: underline animation from left to right on hover
  // - elegant: smooth color transition to primary color
  // - minimal: simple opacity change
  const getLinkClassName = () => {
    const base = "text-sm transition-all duration-300";
    switch (menuVisualStyle) {
      case 'elegant':
        return cn(
          base,
          "text-muted-foreground relative",
          "hover:text-primary"
        );
      case 'minimal':
        return cn(
          base,
          "text-muted-foreground/70",
          "hover:text-muted-foreground hover:opacity-100"
        );
      case 'classic':
      default:
        return cn(
          base,
          "text-muted-foreground relative group/footerlink",
          "hover:text-foreground",
          // Underline animation
          "after:absolute after:left-0 after:bottom-0 after:h-[1px] after:w-0 after:bg-current after:transition-all after:duration-300",
          "hover:after:w-full"
        );
    }
  };

  // ============================================
  // DEMO DATA: Show demo content for empty sections in editor mode
  // Each section shows demo ONLY when that specific section is empty
  // ============================================
  
  // Demo data for sections without real content
  const demoStoreName = isEditing && (!storeName || storeName === 'Loja') ? 'Minha Loja' : null;
  const demoDescription = isEditing && !storeDescription ? 'Sua loja de confiança com produtos de qualidade e entrega rápida para todo o Brasil.' : null;
  
  const demoContactData = isEditing && !hasContact ? {
    phone: '(11) 99999-9999',
    whatsapp: '(11) 99999-9999',
    email: 'contato@minhaloja.com',
    address: 'Av. Exemplo, 1000 - São Paulo, SP',
    hours: 'Seg a Sex: 9h às 18h',
  } : null;
  
  const demoSocialMedia = isEditing && !hasSocialMedia ? {
    facebook: 'https://facebook.com/minhaloja',
    instagram: 'https://instagram.com/minhaloja',
  } : null;
  
  // Use demo or real data
  const displayStoreName = demoStoreName || storeName;
  const displayDescription = demoDescription || storeDescription;
  const displayPhone = demoContactData?.phone || phone;
  const displayWhatsApp = demoContactData?.whatsapp || whatsApp;
  const displayEmail = demoContactData?.email || email;
  const displayAddress = demoContactData?.address || address;
  const displayHours = demoContactData?.hours || supportHours;
  const displayFacebook = demoSocialMedia?.facebook || socialFacebook;
  const displayInstagram = demoSocialMedia?.instagram || socialInstagram;
  
  // Generate demo hrefs
  const displayWhatsAppHref = demoContactData ? getWhatsAppHref(demoContactData.whatsapp) : whatsAppHref;
  const displayPhoneHref = demoContactData ? getPhoneHref(demoContactData.phone) : phoneHref;
  const displayEmailHref = demoContactData ? getEmailHref(demoContactData.email) : emailHref;
  
  // Check if demo mode for styling
  const showDemoContact = Boolean(demoContactData);
  const showDemoSocial = Boolean(demoSocialMedia);
  const showDemoStore = Boolean(demoStoreName || demoDescription);

  return (
    <footer
      className="border-t bg-muted/30"
      style={footerStyle}
    >
      {/* 
        NEWSLETTER BANNER - Full width section at the top of footer
        Shown when newsletter is enabled
      */}
      {showNewsletter && (
        <div 
          className="w-full py-8 md:py-10 border-b"
          style={{ backgroundColor: footerBgColor || undefined }}
        >
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
              {/* Text content */}
              <div className="text-center md:text-left flex-shrink-0">
                <h3 
                  className="text-lg md:text-xl font-semibold uppercase tracking-wide mb-1"
                  style={{ color: footerTitlesColor || footerTextColor || undefined }}
                >
                  {newsletterTitle}
                </h3>
                {newsletterSubtitle && (
                  <p 
                    className="text-sm opacity-80"
                    style={{ color: footerTextColor || undefined }}
                  >
                    {newsletterSubtitle}
                  </p>
                )}
              </div>
              
              {/* Form - horizontal on desktop */}
              <div className="w-full md:w-auto md:min-w-[400px] md:max-w-[500px]">
                <FooterNewsletterForm
                  tenantId={tenantId}
                  title="" 
                  subtitle=""
                  placeholder={newsletterPlaceholder}
                  buttonText={newsletterButtonText || undefined}
                  successMessage={newsletterSuccessMessage}
                  listId={newsletterListId || undefined}
                  textColor={footerTextColor || undefined}
                  buttonBgColor={primaryColor}
                  buttonTextColor={undefined}
                  isEditing={isEditing}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        Footer Container:
        - Mobile (xs/sm): centered with good padding
        - Desktop (md+): full container
      */}
      <div className="w-full py-10 md:py-12">
        {/* Mobile: single column, stacked layout with full width and proper padding */}
        <div className="sf-footer-mobile px-6">
          {/* Inner container for mobile - full width for better horizontal fill */}
          <div className="w-full space-y-8">
            
            {/* MOBILE BLOCO 1: Informações do Negócio */}
            <div className="flex flex-col items-center text-center">
              {/* Logo */}
              {showLogo && (
                <div className="mb-4">
                  <Link to={baseUrl} onClick={e => isEditing && e.preventDefault()}>
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={displayStoreName || 'Loja'}
                        className="h-12 max-w-[180px] object-contain"
                        loading="lazy"
                        decoding="async"
                        width={180}
                        height={48}
                      />
                    ) : (
                      <span
                        className={cn(
                          "text-xl font-bold block",
                          showDemoStore && "opacity-50"
                        )}
                        style={{ color: footerTextColor || primaryColor }}
                      >
                        {displayStoreName}
                        {showDemoStore && <span className="text-xs font-normal ml-1">[Demo]</span>}
                      </span>
                    )}
                  </Link>
                </div>
              )}
              
              {/* Nome Fantasia / Descrição - respects showStoreInfo */}
              {showStoreInfo && (
                <div className="space-y-2">
                  {!showLogo && displayStoreName && (
                    <h4 
                      className={cn(
                        "text-lg font-semibold",
                        showDemoStore && "opacity-50"
                      )}
                      style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                    >
                      {displayStoreName}
                      {showDemoStore && <span className="text-xs font-normal ml-1">[Demo]</span>}
                    </h4>
                  )}
                  
                  {(storeDescription || demoDescription) && (
                    <p 
                      className={cn(
                        "text-sm text-muted-foreground leading-relaxed",
                        demoDescription && "opacity-50 italic"
                      )}
                      style={footerTextColor ? { color: footerTextColor, opacity: demoDescription ? 0.5 : 0.8 } : {}}
                    >
                      {displayDescription}
                      {demoDescription && <span className="text-xs ml-1">[Demo]</span>}
                    </p>
                  )}
                  
                  {/* CNPJ (formatted) */}
                  {cnpj && (
                    <p 
                      className="text-xs text-muted-foreground pt-1"
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.6 } : {}}
                    >
                      CNPJ: {formatCnpj(cnpj)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* MOBILE BLOCO 2: Atendimento (SAC) - Full width, left aligned for readability */}
            {showSac && (hasContact || showDemoContact) && (
              <div className={cn(
                "flex flex-col w-full bg-muted/20 rounded-lg p-4",
                showDemoContact && "border border-dashed border-muted-foreground/20"
              )}>
                <h4 
                  className="font-semibold mb-4 text-base"
                  style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                >
                  {sacTitle}
                  {showDemoContact && <span className="text-xs font-normal text-muted-foreground/50 ml-2">[Demo]</span>}
                </h4>
                <div className={cn(
                  "flex flex-col gap-3 w-full",
                  showDemoContact && "opacity-50"
                )}>
                  {displayWhatsAppHref && (
                    <a
                      href={displayWhatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                      onClick={e => isEditing && e.preventDefault()}
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                    >
                      <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  {displayPhoneHref && (
                    <a
                      href={displayPhoneHref}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                      onClick={e => isEditing && e.preventDefault()}
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                    >
                      <Phone className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span>{displayPhone}</span>
                    </a>
                  )}
                  {displayEmailHref && (
                    <a
                      href={displayEmailHref}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                      onClick={e => isEditing && e.preventDefault()}
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                    >
                      <Mail className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="break-all">{displayEmail}</span>
                    </a>
                  )}
                  {displayAddress && (
                    <div 
                      className="text-sm text-muted-foreground flex items-start gap-2 w-full"
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                    >
                      <span className="text-xs flex-shrink-0 pt-0.5">📍</span>
                      <span className="leading-relaxed flex-1" style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}>{displayAddress}</span>
                    </div>
                  )}
                  {displayHours && (
                    <div 
                      className="text-sm text-muted-foreground inline-flex items-center gap-2"
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.7 } : {}}
                    >
                      <span className="text-xs flex-shrink-0">🕐</span>
                      <span>{displayHours}</span>
                    </div>
                  )}
                </div>
                {showDemoContact && (
                  <p className="text-xs text-muted-foreground/40 mt-3 text-center italic">
                    Configure em Configurações da Loja
                  </p>
                )}
              </div>
            )}

            {/* MOBILE BLOCO 3: Redes Sociais */}
            {showSocial && (hasSocialMedia || showDemoSocial) && (
              <div className="flex flex-col items-center">
                <h4 
                  className="font-semibold mb-4 text-base"
                  style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                >
                  Redes Sociais
                  {showDemoSocial && <span className="text-xs font-normal text-muted-foreground/50 ml-2">[Demo]</span>}
                </h4>
                <div className={cn(
                  "flex gap-6 justify-center flex-wrap",
                  showDemoSocial && "opacity-50"
                )}>
                  {displayFacebook && (
                    <a
                      href={displayFacebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-blue-600 transition-colors"
                      onClick={e => isEditing && e.preventDefault()}
                      style={footerTextColor ? { color: footerTextColor } : {}}
                      aria-label="Facebook"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                  )}
                  {displayInstagram && (
                    <a
                      href={displayInstagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-pink-600 transition-colors"
                      onClick={e => isEditing && e.preventDefault()}
                      style={footerTextColor ? { color: footerTextColor } : {}}
                      aria-label="Instagram"
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
                      aria-label="TikTok"
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
                      aria-label="YouTube"
                    >
                      <Youtube className="h-5 w-5" />
                    </a>
                  )}
                  {socialCustom.map((social, idx) => (
                    <a
                      key={idx}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={e => isEditing && e.preventDefault()}
                      style={footerTextColor ? { color: footerTextColor } : {}}
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
                {showDemoSocial && (
                  <p className="text-xs text-muted-foreground/40 mt-2 italic">
                    Configure em Configurações da Loja
                  </p>
                )}
              </div>
            )}

            {/* MOBILE BLOCO 4: Footer Menu 1 */}
            {showFooter1 && (validFooter1Items.length > 0 || isEditing) && (
              <div className="flex flex-col items-center text-center">
                <h4 
                  className="font-semibold mb-3"
                  style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                >
                  {footer1Name}
                </h4>
                <nav className="flex flex-col gap-2">
                  {validFooter1Items.length > 0 ? (
                    validFooter1Items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.resolvedUrl}
                        className={getLinkClassName()}
                        style={footerTextColor ? { color: footerTextColor } : {}}
                      >
                        {item.label}
                      </Link>
                    ))
                  ) : isEditing ? (
                    <>
                      {['Novidades', 'Mais Vendidos', 'Promoções'].map((label, i) => (
                        <span
                          key={i}
                          className="text-sm text-muted-foreground/50 cursor-default"
                          style={footerTextColor ? { color: footerTextColor, opacity: 0.4 } : {}}
                        >
                          {label}
                        </span>
                      ))}
                      <p className="text-xs text-muted-foreground/40 mt-2 italic">
                        [Demo] Configure em Menus
                      </p>
                    </>
                  ) : null}
                  {/* Warning when items are hidden due to unpublished pages */}
                  {isEditing && footer1HiddenCount > 0 && (
                    <p className="text-xs text-amber-500 mt-2 italic">
                      ⚠️ {footer1HiddenCount} item(ns) oculto(s) - páginas não publicadas
                    </p>
                  )}
                </nav>
              </div>
            )}

            {/* MOBILE BLOCO 5: Footer Menu 2 */}
            {showFooter2 && (validFooter2Items.length > 0 || isEditing) && (
              <div className="flex flex-col items-center text-center">
                <h4 
                  className="font-semibold mb-3"
                  style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                >
                  {footer2Name}
                </h4>
                <nav className="flex flex-col gap-2">
                  {validFooter2Items.length > 0 ? (
                    validFooter2Items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.resolvedUrl}
                        className={getLinkClassName()}
                        style={footerTextColor ? { color: footerTextColor } : {}}
                      >
                        {item.label}
                      </Link>
                    ))
                  ) : isEditing ? (
                    <>
                      {['Sobre Nós', 'Política de Privacidade', 'Termos de Uso'].map((label, i) => (
                        <span
                          key={i}
                          className="text-sm text-muted-foreground/50 cursor-default"
                          style={footerTextColor ? { color: footerTextColor, opacity: 0.4 } : {}}
                        >
                          {label}
                        </span>
                      ))}
                      <p className="text-xs text-muted-foreground/40 mt-2 italic">
                        [Demo] Configure em Menus
                      </p>
                    </>
                  ) : null}
                  {/* Warning when items are hidden due to unpublished pages */}
                  {isEditing && footer2HiddenCount > 0 && (
                    <p className="text-xs text-amber-500 mt-2 italic">
                      ⚠️ {footer2HiddenCount} item(ns) oculto(s) - páginas não publicadas
                    </p>
                  )}
                </nav>
              </div>
            )}

            {/* Newsletter is now shown as a full-width banner at the top of footer */}
            
          </div>
        </div>

        {/* Desktop: 4-column grid */}
        <div className="sf-footer-desktop container mx-auto px-4">
          
          {/* ============================================ */}
          {/* COLUNA 1: Informações do Negócio */}
          {/* ============================================ */}
          {(showLogo || showStoreInfo) && (
            <div className="flex flex-col items-start text-left">
              {/* Logo */}
              {showLogo && (
                <div className="mb-4">
                  <Link to={baseUrl} onClick={e => isEditing && e.preventDefault()}>
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={displayStoreName || 'Loja'}
                        className="h-12 max-w-[180px] object-contain"
                        loading="lazy"
                        decoding="async"
                        width={180}
                        height={48}
                      />
                    ) : (
                      <span
                        className={cn(
                          "text-2xl font-bold block",
                          showDemoStore && "opacity-50"
                        )}
                        style={{ color: footerTextColor || primaryColor }}
                      >
                        {displayStoreName}
                        {showDemoStore && <span className="text-xs font-normal ml-1">[Demo]</span>}
                      </span>
                    )}
                  </Link>
                </div>
              )}
              
              {/* Nome Fantasia / Descrição - respects showStoreInfo */}
              {showStoreInfo && (
                <div className="space-y-2 w-full">
                  {!showLogo && displayStoreName && (
                    <h4 
                      className={cn(
                        "text-lg font-semibold",
                        showDemoStore && "opacity-50"
                      )}
                      style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                    >
                      {displayStoreName}
                      {showDemoStore && <span className="text-xs font-normal ml-1">[Demo]</span>}
                    </h4>
                  )}
                  
                  {(storeDescription || demoDescription) && (
                    <p 
                      className={cn(
                        "text-sm text-muted-foreground leading-relaxed",
                        demoDescription && "opacity-50 italic"
                      )}
                      style={footerTextColor ? { color: footerTextColor, opacity: demoDescription ? 0.5 : 0.8 } : {}}
                    >
                      {displayDescription}
                      {demoDescription && <span className="text-xs ml-1">[Demo]</span>}
                    </p>
                  )}
                  
                  {/* CNPJ (formatted) */}
                  {cnpj && (
                    <p 
                      className="text-xs text-muted-foreground pt-1"
                      style={footerTextColor ? { color: footerTextColor, opacity: 0.6 } : {}}
                    >
                      CNPJ: {formatCnpj(cnpj)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* COLUNA 2: Atendimento + Redes Sociais */}
          {/* ============================================ */}
          {((showSac && (hasContact || showDemoContact)) || (showSocial && (hasSocialMedia || showDemoSocial))) && (
            <div className="flex flex-col items-start text-left space-y-6">
              
              {/* Sub-bloco 2.1: Atendimento (SAC) */}
              {showSac && (hasContact || showDemoContact) && (
                <div className="w-full">
                  <h4 
                    className="font-semibold mb-3"
                    style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                  >
                    {sacTitle}
                    {showDemoContact && <span className="text-xs font-normal text-muted-foreground/50 ml-2">[Demo]</span>}
                  </h4>
                  <div className={cn("flex flex-col gap-2.5", showDemoContact && "opacity-50")}>
                    {displayWhatsAppHref && (
                      <a
                        href={displayWhatsAppHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                        onClick={e => isEditing && e.preventDefault()}
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                      >
                        <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {displayPhoneHref && (
                      <a
                        href={displayPhoneHref}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                        onClick={e => isEditing && e.preventDefault()}
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                      >
                        <Phone className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span>{displayPhone}</span>
                      </a>
                    )}
                    {displayEmailHref && (
                      <a
                        href={displayEmailHref}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                        onClick={e => isEditing && e.preventDefault()}
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                      >
                        <Mail className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <span className="break-all">{displayEmail}</span>
                      </a>
                    )}
                    {displayAddress && (
                      <div 
                        className="text-sm text-muted-foreground flex items-start gap-2"
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                      >
                        <span className="text-xs flex-shrink-0 pt-0.5">📍</span>
                        <span className="leading-relaxed">{displayAddress}</span>
                      </div>
                    )}
                    {displayHours && (
                      <div 
                        className="text-sm text-muted-foreground inline-flex items-center gap-2"
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.7 } : {}}
                      >
                        <span className="text-xs flex-shrink-0">🕐</span>
                        <span>{displayHours}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-bloco 2.2: Redes Sociais */}
              {showSocial && (hasSocialMedia || showDemoSocial) && (
                <div className="w-full">
                  <h4 
                    className="font-semibold mb-3"
                    style={footerTitlesColor ? { color: footerTitlesColor } : {}}
                  >
                    Redes Sociais
                    {showDemoSocial && <span className="text-xs font-normal text-muted-foreground/50 ml-2">[Demo]</span>}
                  </h4>
                  <div className={cn("flex gap-5 flex-wrap", showDemoSocial && "opacity-50")}>
                    {displayFacebook && (
                      <a
                        href={displayFacebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-blue-600 transition-colors"
                        onClick={e => isEditing && e.preventDefault()}
                        style={footerTextColor ? { color: footerTextColor } : {}}
                        aria-label="Facebook"
                      >
                        <Facebook className="h-5 w-5" />
                      </a>
                    )}
                    {displayInstagram && (
                      <a
                        href={displayInstagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-pink-600 transition-colors"
                        onClick={e => isEditing && e.preventDefault()}
                        style={footerTextColor ? { color: footerTextColor } : {}}
                        aria-label="Instagram"
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
                        aria-label="TikTok"
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
                        aria-label="YouTube"
                      >
                        <Youtube className="h-5 w-5" />
                      </a>
                    )}
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
          )}

          {/* ============================================ */}
          {/* COLUNA 3: Footer Menu 1 */}
          {/* ============================================ */}
          {showFooter1 && (validFooter1Items.length > 0 || isEditing) && (
            <div className="text-left">
              <h4 
                className="font-semibold mb-3"
                style={footerTitlesColor ? { color: footerTitlesColor } : {}}
              >
                {footer1Name}
              </h4>
              <nav className="flex flex-col gap-2">
                {validFooter1Items.length > 0 ? (
                  validFooter1Items.map((item) => (
                    <Link
                      key={item.id}
                      to={item.resolvedUrl}
                      className={getLinkClassName()}
                      style={footerTextColor ? { color: footerTextColor } : {}}
                    >
                      {item.label}
                    </Link>
                  ))
                ) : isEditing ? (
                  <>
                    {['Novidades', 'Mais Vendidos', 'Promoções'].map((label, i) => (
                      <span
                        key={i}
                        className="text-sm text-muted-foreground/50 cursor-default"
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.4 } : {}}
                      >
                        {label}
                      </span>
                    ))}
                    <p className="text-xs text-muted-foreground/40 mt-2 italic">
                      [Demo] Configure em Menus
                    </p>
                  </>
                ) : null}
                {/* Warning when items are hidden due to unpublished pages */}
                {isEditing && footer1HiddenCount > 0 && (
                  <p className="text-xs text-amber-500 mt-2 italic">
                    ⚠️ {footer1HiddenCount} item(ns) oculto(s) - páginas não publicadas
                  </p>
                )}
              </nav>
            </div>
          )}

          {/* ============================================ */}
          {/* COLUNA 4: Footer Menu 2 */}
          {/* ============================================ */}
          {showFooter2 && (validFooter2Items.length > 0 || isEditing) && (
            <div className="text-left">
              <h4 
                className="font-semibold mb-3"
                style={footerTitlesColor ? { color: footerTitlesColor } : {}}
              >
                {footer2Name}
              </h4>
              <nav className="flex flex-col gap-2">
                {validFooter2Items.length > 0 ? (
                  validFooter2Items.map((item) => (
                    <Link
                      key={item.id}
                      to={item.resolvedUrl}
                      className={getLinkClassName()}
                      style={footerTextColor ? { color: footerTextColor } : {}}
                    >
                      {item.label}
                    </Link>
                  ))
                ) : isEditing ? (
                  <>
                    {['Sobre Nós', 'Política de Privacidade', 'Termos de Uso'].map((label, i) => (
                      <span
                        key={i}
                        className="text-sm text-muted-foreground/50 cursor-default"
                        style={footerTextColor ? { color: footerTextColor, opacity: 0.4 } : {}}
                      >
                        {label}
                      </span>
                    ))}
                    <p className="text-xs text-muted-foreground/40 mt-2 italic">
                      [Demo] Configure em Menus
                    </p>
                  </>
                ) : null}
                {/* Warning when items are hidden due to unpublished pages */}
                {isEditing && footer2HiddenCount > 0 && (
                  <p className="text-xs text-amber-500 mt-2 italic">
                    ⚠️ {footer2HiddenCount} item(ns) oculto(s) - páginas não publicadas
                  </p>
                )}
              </nav>
            </div>
          )}

          {/* Newsletter is now shown as a full-width banner at the top of footer */}
        </div>

        {/* Image Sections: Payment, Security, Shipping, Official Stores */}
        {hasImageSections && (
          <div className="border-t mt-6 md:mt-8 pt-6 md:pt-8 px-6 md:px-0 md:container md:mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {/* Payment Methods - respects showPaymentMethods toggle */}
            {showPaymentMethods && paymentMethods.items.length > 0 && (
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
                      className={`${paymentBadgeSizeClasses[badgeSize]} w-auto object-contain`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Security Seals - respects showSecuritySeals toggle */}
            {showSecuritySeals && securitySeals.items.length > 0 && (
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
                          src={getLogoImageUrl(item.imageUrl, 200)}
                          alt={`Selo ${index + 1}`}
                          className={`${badgeSizeClasses[badgeSize]} w-auto object-contain`}
                          loading="lazy"
                          decoding="async"
                        />
                      </a>
                    ) : (
                      <img
                        key={index}
                        src={getLogoImageUrl(item.imageUrl, 200)}
                        alt={`Selo ${index + 1}`}
                        className={`${badgeSizeClasses[badgeSize]} w-auto object-contain`}
                        loading="lazy"
                        decoding="async"
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
                      src={getLogoImageUrl(item.imageUrl, 200)}
                      alt={`Envio ${index + 1}`}
                      className={`${badgeSizeClasses[badgeSize]} w-auto object-contain`}
                      loading="lazy"
                      decoding="async"
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
                        src={getLogoImageUrl(item.imageUrl, 200)}
                        alt={`Loja ${index + 1}`}
                        className={`${badgeSizeClasses[badgeSize]} w-auto object-contain hover:opacity-80 transition-opacity`}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legal info / Copyright - respects showCopyright toggle */}
        {showCopyright && (
          <div className="border-t mt-6 md:mt-8 pt-6 md:pt-8 text-center px-6 md:px-0 md:container md:mx-auto">
            {/* Custom copyright text override OR default copyright */}
            {legalTextOverride ? (
              <p 
                className="text-sm text-muted-foreground" 
                style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
              >
                {legalTextOverride}
              </p>
            ) : (
              <>
                {/* Razão Social + CNPJ */}
                {(legalName || cnpj) && (
                  <p 
                    className="text-xs text-muted-foreground mb-2"
                    style={footerTextColor ? { color: footerTextColor, opacity: 0.7 } : {}}
                  >
                    {legalName}
                    {legalName && cnpj && ' - '}
                    {cnpj && `CNPJ: ${formatCnpj(cnpj)}`}
                  </p>
                )}
                
                {/* Copyright */}
                <p 
                  className="text-sm text-muted-foreground"
                  style={footerTextColor ? { color: footerTextColor, opacity: 0.8 } : {}}
                >
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
