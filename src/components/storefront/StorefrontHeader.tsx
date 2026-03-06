import { usePublicStorefront } from '@/hooks/useStorefront';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useCart } from '@/contexts/CartContext';
import { StorefrontHeaderContent } from './StorefrontHeaderContent';

/**
 * StorefrontHeader - Wrapper component for public storefront header
 * Uses the unified StorefrontHeaderContent for consistent rendering
 * OPTIMIZED: Uses bootstrap data for globalLayout and pages — ZERO extra queries
 * Uses useTenantSlug() to resolve tenant from URL params OR context (custom domain)
 */
export function StorefrontHeader() {
  const tenantSlug = useTenantSlug();
  const { storeSettings, headerMenu, categories, tenant, globalLayout, pages } = usePublicStorefront(tenantSlug);
  const { totalItems } = useCart();

  return (
    <StorefrontHeaderContent 
      tenantSlug={tenantSlug} 
      headerConfig={globalLayout?.header_config}
      storeSettings={storeSettings}
      menuItems={headerMenu?.items || []}
      categories={categories || []}
      pagesData={pages || []}
      totalCartItems={totalItems}
      isEditing={false}
      tenantId={tenant?.id}
    />
  );
}
