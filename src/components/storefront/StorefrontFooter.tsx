import { Link, useParams } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Phone, Mail, Youtube } from 'lucide-react';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MenuItem } from '@/hooks/useStorefront';
import { getStoreBaseUrl, getPublicCategoryUrl, getPublicPageUrl, getPublicLandingUrl } from '@/lib/publicUrls';
import { getWhatsAppHref, getPhoneHref, getEmailHref, isValidWhatsApp, isValidPhone, isValidEmail } from '@/lib/contactHelpers';

// TikTok icon component (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

export function StorefrontFooter() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, footerMenu, categories, tenant } = usePublicStorefront(tenantSlug || '');

  // Fetch pages for resolving page menu item URLs
  const { data: pagesData } = useQuery({
    queryKey: ['storefront-pages', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from('store_pages')
        .select('id, slug, type')
        .eq('tenant_id', tenant.id)
        .eq('is_published', true);
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const baseUrl = getStoreBaseUrl(tenantSlug || '');
  const menuItems = footerMenu?.items || [];

  const getMenuItemUrl = (item: MenuItem): string => {
    if (item.item_type === 'external' && item.url) {
      return item.url;
    }
    if (item.item_type === 'category' && item.ref_id) {
      const category = categories?.find(c => c.id === item.ref_id);
      return category ? getPublicCategoryUrl(tenantSlug || '', category.slug) || baseUrl : baseUrl;
    }
    if (item.item_type === 'page' && item.ref_id) {
      const page = pagesData?.find(p => p.id === item.ref_id);
      if (page) {
        const urlFn = page.type === 'landing_page' ? getPublicLandingUrl : getPublicPageUrl;
        return urlFn(tenantSlug || '', page.slug) || baseUrl;
      }
      return baseUrl;
    }
    return baseUrl;
  };

  const primaryColor = storeSettings?.primary_color || '#6366f1';
  
  // Contact info from store_settings
  const whatsApp = storeSettings?.social_whatsapp || null;
  const phone = storeSettings?.contact_phone || null;
  const email = storeSettings?.contact_email || null;
  const supportHours = storeSettings?.contact_support_hours || null;
  const address = storeSettings?.contact_address || null;
  
  // Business info
  const storeName = storeSettings?.store_name || 'Loja';
  const storeDescription = storeSettings?.store_description || null;
  const legalName = storeSettings?.business_legal_name || null;
  const cnpj = storeSettings?.business_cnpj || null;
  const logoUrl = storeSettings?.logo_url || null;
  
  // Social media
  const socialFacebook = storeSettings?.social_facebook || null;
  const socialInstagram = storeSettings?.social_instagram || null;
  const socialTiktok = storeSettings?.social_tiktok || null;
  const socialYoutube = storeSettings?.social_youtube || null;
  const socialCustom = storeSettings?.social_custom || [];
  
  // Contact hrefs using helpers
  const whatsAppHref = getWhatsAppHref(whatsApp);
  const phoneHref = getPhoneHref(phone);
  const emailHref = getEmailHref(email);
  
  const hasContact = isValidWhatsApp(whatsApp) || isValidPhone(phone) || isValidEmail(email);
  const hasSocialMedia = socialFacebook || socialInstagram || socialTiktok || socialYoutube || (socialCustom && socialCustom.length > 0);

  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Logo - First item, centered */}
        <div className="flex justify-center mb-8">
          <Link to={baseUrl}>
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
          <div className="text-center md:text-left">
            <h4 className="font-semibold text-gray-900 mb-4">Atendimento (SAC)</h4>
            <div className="flex flex-col gap-3">
              {whatsAppHref && (
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2 justify-center md:justify-start"
                >
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  <span>WhatsApp</span>
                </a>
              )}
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2 justify-center md:justify-start"
                >
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span>{phone}</span>
                </a>
              )}
              {emailHref && (
                <a
                  href={emailHref}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2 justify-center md:justify-start"
                >
                  <Mail className="h-4 w-4 text-red-600" />
                  <span>{email}</span>
                </a>
              )}
              {supportHours && (
                <p className="text-sm text-gray-500 mt-2">
                  {supportHours}
                </p>
              )}
            </div>
          </div>

          {/* Footer Menu Links */}
          {menuItems.length > 0 && (
            <div className="text-center md:text-left">
              <h4 className="font-semibold text-gray-900 mb-4">Links</h4>
              <nav className="flex flex-col gap-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.id}
                    to={getMenuItemUrl(item)}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
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
              <h4 className="font-semibold text-gray-900 mb-4">Categorias</h4>
              <nav className="flex flex-col gap-2">
                {categories.slice(0, 5).map((category) => (
                  <Link
                    key={category.id}
                    to={getPublicCategoryUrl(tenantSlug || '', category.slug) || baseUrl}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
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
              <h4 className="font-semibold text-gray-900 mb-4">Redes Sociais</h4>
              <div className="flex gap-4 justify-center md:justify-start">
                {socialFacebook && (
                  <a
                    href={socialFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                )}
                {socialInstagram && (
                  <a
                    href={socialInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-pink-600 transition-colors"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {socialTiktok && (
                  <a
                    href={socialTiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <TikTokIcon className="h-5 w-5" />
                  </a>
                )}
                {socialYoutube && (
                  <a
                    href={socialYoutube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-red-600 transition-colors"
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
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    title={social.label}
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
            <p className="text-sm text-gray-600 mb-4 max-w-2xl mx-auto">
              {storeDescription}
            </p>
          )}
          
          {/* Business info */}
          <div className="text-xs text-gray-500 space-y-1 mb-4">
            {legalName && <p>{legalName}</p>}
            {cnpj && <p>CNPJ: {cnpj}</p>}
            {address && <p>{address}</p>}
          </div>
          
          {/* Copyright */}
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
