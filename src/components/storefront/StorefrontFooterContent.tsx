import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Phone, Mail, Youtube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStoreBaseUrl, getPublicCategoryUrl, getPublicPageUrl, getPublicLandingUrl } from '@/lib/publicUrls';
import { getWhatsAppHref, getPhoneHref, getEmailHref, isValidWhatsApp, isValidPhone, isValidEmail } from '@/lib/contactHelpers';
import { BlockRenderContext } from '@/lib/builder/types';

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

interface StorefrontFooterContentProps {
  context: BlockRenderContext;
  isEditing?: boolean;
}

export function StorefrontFooterContent({ context, isEditing }: StorefrontFooterContentProps) {
  const tenantSlug = context?.tenantSlug || '';
  const settings = context?.settings;

  // Fetch store settings
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
        .select('*')
        .eq('tenant_id', tenant.id)
        .single();
      
      return data;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch categories
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

  // Fetch footer menu
  const { data: footerMenu } = useQuery({
    queryKey: ['footer-menu', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();
      
      if (!tenant) return null;
      
      const { data: menu } = await supabase
        .from('menus')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('location', 'footer')
        .maybeSingle();
      
      if (!menu) return null;
      
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, label, url, item_type, ref_id')
        .eq('menu_id', menu.id)
        .order('sort_order');
      
      return items || [];
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
  const menuItems: MenuItem[] = footerMenu || [];

  const getMenuItemUrl = (item: MenuItem): string => {
    if (item.item_type === 'external' && item.url) {
      return item.url;
    }
    if (item.item_type === 'category' && item.ref_id) {
      const category = categories?.find((c: Category) => c.id === item.ref_id);
      return category ? getPublicCategoryUrl(tenantSlug, category.slug) || baseUrl : baseUrl;
    }
    if (item.item_type === 'page' && item.ref_id) {
      const page = pagesData?.find(p => p.id === item.ref_id);
      if (page) {
        const urlFn = page.type === 'landing_page' ? getPublicLandingUrl : getPublicPageUrl;
        return urlFn(tenantSlug, page.slug) || baseUrl;
      }
      return baseUrl;
    }
    return baseUrl;
  };

  // Use store_settings from query - this is the primary source
  // storeSettings has all the new fields we need
  const effectiveSettings = storeSettings as Record<string, any> | null;
  
  const primaryColor = effectiveSettings?.primary_color || settings?.primary_color || '#6366f1';
  
  // Contact info from store_settings
  const whatsApp = effectiveSettings?.social_whatsapp || null;
  const phone = effectiveSettings?.contact_phone || null;
  const email = effectiveSettings?.contact_email || null;
  const supportHours = effectiveSettings?.contact_support_hours || null;
  const address = effectiveSettings?.contact_address || null;
  
  // Business info
  const storeName = effectiveSettings?.store_name || settings?.store_name || 'Loja';
  const storeDescription = effectiveSettings?.store_description || settings?.store_description || null;
  const legalName = effectiveSettings?.business_legal_name || null;
  const cnpj = effectiveSettings?.business_cnpj || null;
  const logoUrl = effectiveSettings?.logo_url || settings?.logo_url || null;
  
  // Social media
  const socialFacebook = effectiveSettings?.social_facebook || settings?.social_facebook || null;
  const socialInstagram = effectiveSettings?.social_instagram || settings?.social_instagram || null;
  const socialTiktok = effectiveSettings?.social_tiktok || null;
  const socialYoutube = effectiveSettings?.social_youtube || null;
  const socialCustom: Array<{ label: string; url: string }> = effectiveSettings?.social_custom || [];
  
  // Contact hrefs using helpers
  const whatsAppHref = getWhatsAppHref(whatsApp);
  const phoneHref = getPhoneHref(phone);
  const emailHref = getEmailHref(email);
  
  const hasContact = isValidWhatsApp(whatsApp) || isValidPhone(phone) || isValidEmail(email);
  const hasSocialMedia = socialFacebook || socialInstagram || socialTiktok || socialYoutube || (socialCustom && socialCustom.length > 0);

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Logo - First item, centered */}
        <div className="flex justify-center mb-8">
          <Link to={baseUrl} onClick={e => isEditing && e.preventDefault()}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                className="h-12 max-w-[200px] object-contain"
              />
            ) : (
              <span
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                {storeName}
              </span>
            )}
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Atendimento (SAC) */}
          {hasContact && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold text-foreground mb-4">Atendimento (SAC)</h4>
              <div className="flex flex-col gap-3">
                {whatsAppHref && (
                  <a
                    href={whatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 justify-center md:justify-start"
                    onClick={e => isEditing && e.preventDefault()}
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
                  >
                    <Mail className="h-4 w-4 text-red-600" />
                    <span>{email}</span>
                  </a>
                )}
                {supportHours && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {supportHours}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer Menu Links */}
          {menuItems.length > 0 && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold text-foreground mb-4">Links</h4>
              <nav className="flex flex-col gap-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.id}
                    to={getMenuItemUrl(item)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
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
              <h4 className="font-semibold text-foreground mb-4">Categorias</h4>
              <nav className="flex flex-col gap-2">
                {categories.map((category: Category) => (
                  <Link
                    key={category.id}
                    to={getPublicCategoryUrl(tenantSlug, category.slug) || baseUrl}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
                  >
                    {category.name}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Social Media */}
          {hasSocialMedia && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold text-foreground mb-4">Redes Sociais</h4>
              <div className="flex gap-4 justify-center md:justify-start">
                {socialFacebook && (
                  <a
                    href={socialFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-blue-600 transition-colors"
                    onClick={e => isEditing && e.preventDefault()}
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
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legal info / Copyright */}
        <div className="border-t mt-8 pt-8 text-center">
          {/* Store description */}
          {storeDescription && (
            <p className="text-sm text-muted-foreground mb-4 max-w-2xl mx-auto">
              {storeDescription}
            </p>
          )}
          
          {/* Business info */}
          <div className="text-xs text-muted-foreground space-y-1 mb-4">
            {legalName && <p>{legalName}</p>}
            {cnpj && <p>CNPJ: {cnpj}</p>}
            {address && <p>{address}</p>}
          </div>
          
          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
