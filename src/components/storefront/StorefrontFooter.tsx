import { Link, useParams } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle } from 'lucide-react';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MenuItem } from '@/hooks/useStorefront';

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

  const baseUrl = `/store/${tenantSlug}`;
  const menuItems = footerMenu?.items || [];

  const getMenuItemUrl = (item: MenuItem): string => {
    if (item.item_type === 'external' && item.url) {
      return item.url;
    }
    if (item.item_type === 'category' && item.ref_id) {
      const category = categories?.find(c => c.id === item.ref_id);
      return category ? `${baseUrl}/c/${category.slug}` : baseUrl;
    }
    if (item.item_type === 'page' && item.ref_id) {
      const page = pagesData?.find(p => p.id === item.ref_id);
      if (page) {
        return `${baseUrl}/page/${page.slug}`;
      }
      return baseUrl;
    }
    return baseUrl;
  };

  const primaryColor = storeSettings?.primary_color || '#6366f1';

  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to={baseUrl} className="inline-block mb-4">
              {storeSettings?.logo_url ? (
                <img
                  src={storeSettings.logo_url}
                  alt={storeSettings?.store_name || 'Loja'}
                  className="h-10 max-w-[160px] object-contain"
                />
              ) : (
                <span
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {storeSettings?.store_name || 'Loja'}
                </span>
              )}
            </Link>
            {storeSettings?.store_description && (
              <p className="text-sm text-gray-600 max-w-md">
                {storeSettings.store_description}
              </p>
            )}

            {/* Social Links */}
            <div className="flex gap-4 mt-6">
              {storeSettings?.social_facebook && (
                <a
                  href={storeSettings.social_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {storeSettings?.social_instagram && (
                <a
                  href={storeSettings.social_instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {storeSettings?.social_whatsapp && (
                <a
                  href={`https://wa.me/${storeSettings.social_whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Footer Links */}
          <div>
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

          {/* Categories */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Categorias</h4>
            <nav className="flex flex-col gap-2">
              {categories?.slice(0, 5).map((category) => (
                <Link
                  key={category.id}
                  to={`${baseUrl}/c/${category.slug}`}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t mt-8 pt-8 text-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} {storeSettings?.store_name || 'Loja'}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
