import { StorefrontFooterContent } from './StorefrontFooterContent';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useTenantSlug } from '@/hooks/useTenantSlug';

/**
 * StorefrontFooter - Wrapper component for public storefront footer
 * OPTIMIZED: Passes ALL bootstrap data as props to eliminate duplicate queries
 * Uses useTenantSlug() to resolve tenant from URL params OR context (custom domain)
 */
export function StorefrontFooter() {
  const tenantSlug = useTenantSlug();
  
  // Get ALL data from bootstrap (single query already made by layout)
  const { 
    storeSettings, 
    categories, 
    footerMenu, 
    footer2Menu, 
    globalLayout, 
    pages,
    tenant,
  } = usePublicStorefront(tenantSlug);
  
  return (
    <StorefrontFooterContent 
      tenantSlug={tenantSlug} 
      footerConfig={globalLayout?.footer_config}
      isEditing={false}
      showFooter1Override={globalLayout?.show_footer_1}
      showFooter2Override={globalLayout?.show_footer_2}
      bootstrapStoreSettings={storeSettings}
      bootstrapCategories={categories}
      bootstrapFooterMenus={{
        footer1: footerMenu?.menu ? { name: footerMenu.menu.name, items: footerMenu.items } : null,
        footer2: footer2Menu?.menu ? { name: footer2Menu.menu.name, items: footer2Menu.items } : null,
      }}
      bootstrapPages={pages}
      bootstrapTenantId={tenant?.id}
    />
  );
}
