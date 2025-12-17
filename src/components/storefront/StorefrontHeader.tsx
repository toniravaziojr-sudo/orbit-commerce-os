import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useCart } from '@/contexts/CartContext';
import { usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StorefrontHeaderContent } from './StorefrontHeaderContent';

/**
 * StorefrontHeader - Wrapper component for public storefront header
 * Uses the unified StorefrontHeaderContent for consistent rendering
 * Fetches global layout and passes header_config for proper priority
 */
export function StorefrontHeader() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, headerMenu, categories, tenant } = usePublicStorefront(tenantSlug || '');
  const { totalItems } = useCart();

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

  // Fetch global layout for header config
  const { data: globalLayout } = usePublicGlobalLayout(tenantSlug || '');
  
  return (
    <StorefrontHeaderContent 
      tenantSlug={tenantSlug || ''} 
      headerConfig={globalLayout?.header_config}
      storeSettings={storeSettings}
      menuItems={headerMenu?.items || []}
      categories={categories || []}
      pagesData={pagesData || []}
      totalCartItems={totalItems}
      isEditing={false}
      tenantId={tenant?.id}
    />
  );
}
