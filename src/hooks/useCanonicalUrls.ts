// =============================================
// USE CANONICAL URLS - Hook for generating canonical URLs in storefront
// Uses the custom domain from context when available
// =============================================

import { useParams } from 'react-router-dom';
import { useCanonicalDomain } from '@/contexts/StorefrontConfigContext';
import {
  getCanonicalOrigin,
  getCanonicalStoreBaseUrl,
  getCanonicalHomeUrl,
  getCanonicalProductUrl,
  getCanonicalCategoryUrl,
  getCanonicalPageUrl,
  getCanonicalCartUrl,
  getCanonicalCheckoutUrl,
  getCanonicalThankYouUrl,
} from '@/lib/publicUrls';

/**
 * Hook that provides canonical URL builders for the current storefront
 * Automatically uses the custom domain when available
 */
export function useCanonicalUrls() {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const { customDomain } = useCanonicalDomain();

  return {
    // The custom domain (or null if using default)
    customDomain,
    
    // The canonical origin (e.g., "https://loja.example.com" or "https://orbit-commerce-os.lovable.app")
    origin: getCanonicalOrigin(customDomain),
    
    // The canonical store base URL
    storeBaseUrl: getCanonicalStoreBaseUrl(tenantSlug, customDomain),
    
    // URL builders
    getHomeUrl: () => getCanonicalHomeUrl(tenantSlug, customDomain),
    
    getProductUrl: (productSlug: string | undefined) => 
      getCanonicalProductUrl(tenantSlug, productSlug, customDomain),
    
    getCategoryUrl: (categorySlug: string | undefined) => 
      getCanonicalCategoryUrl(tenantSlug, categorySlug, customDomain),
    
    getPageUrl: (pageSlug: string | undefined) => 
      getCanonicalPageUrl(tenantSlug, pageSlug, customDomain),
    
    getCartUrl: () => getCanonicalCartUrl(tenantSlug, customDomain),
    
    getCheckoutUrl: () => getCanonicalCheckoutUrl(tenantSlug, customDomain),
    
    getThankYouUrl: () => getCanonicalThankYouUrl(tenantSlug, customDomain),
  };
}
