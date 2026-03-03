import { StorefrontFooterContent } from './StorefrontFooterContent';
import { usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';
import { useTenantSlug } from '@/hooks/useTenantSlug';

/**
 * StorefrontFooter - Wrapper component for public storefront footer
 * Uses the unified StorefrontFooterContent for consistent rendering
 * Fetches global layout and passes footer_config for proper priority
 * Uses useTenantSlug() to resolve tenant from URL params OR context (custom domain)
 */
export function StorefrontFooter() {
  const tenantSlug = useTenantSlug();
  
  // Fetch global layout for footer config
  const { data: globalLayout } = usePublicGlobalLayout(tenantSlug);
  
  return (
    <StorefrontFooterContent 
      tenantSlug={tenantSlug} 
      footerConfig={globalLayout?.footer_config}
      isEditing={false} 
    />
  );
}
