// =============================================
// STOREFRONT URLS HOOK - Context-aware URL generation for storefront
// Automatically detects if on custom domain vs. legacy/app domain
// and generates correct URLs accordingly
// =============================================

import { useMemo } from 'react';
import { useCanonicalDomain } from '@/contexts/StorefrontConfigContext';
import { 
  isPlatformSubdomain, 
  isAppDomain,
  SAAS_CONFIG 
} from '@/lib/canonicalDomainService';
import { hasValidSlug } from '@/lib/slugValidation';

export interface StorefrontUrls {
  home: () => string;
  product: (productSlug: string | undefined) => string | null;
  category: (categorySlug: string | undefined) => string | null;
  cart: () => string;
  checkout: () => string;
  thankYou: (orderNumber?: string) => string;
  page: (pageSlug: string | undefined) => string | null;
  landing: (landingSlug: string | undefined) => string | null;
  account: () => string;
  accountOrders: () => string;
  accountOrderDetail: (orderId: string) => string;
  buildMenuUrl: (item: { item_type: string; url?: string | null; ref_id?: string | null }, categories?: Array<{ id: string; slug: string }>, pages?: Array<{ id: string; slug: string }>) => string;
  isOnCustomDomain: boolean;
}

/**
 * Determine if the current host is a "tenant host" (custom domain or platform subdomain)
 * vs. a legacy/app host where /store/{tenantSlug} paths are needed
 */
function isOnTenantHost(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // If on platform subdomain (tenant.shops.comandocentral.com.br) → tenant host
  if (isPlatformSubdomain(hostname)) {
    return true;
  }
  
  // If NOT on app domain and NOT on fallback origin → likely custom domain
  if (!isAppDomain(hostname)) {
    const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).hostname;
    if (hostname !== fallbackHost) {
      return true;
    }
  }
  
  return false;
}

/**
 * Hook to generate context-aware storefront URLs
 * When on a custom domain or platform subdomain, generates paths without /store/{tenantSlug}
 * When on app/legacy domain, generates full /store/{tenantSlug}/... paths
 */
export function useStorefrontUrls(tenantSlug: string): StorefrontUrls {
  const canonicalDomainContext = useCanonicalDomain();
  
  // Check if we're on a tenant-specific host
  const isOnCustomDomain = useMemo(() => {
    // First check if there's a custom domain configured in context
    if (canonicalDomainContext?.customDomain) {
      const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
      const customDomain = canonicalDomainContext.customDomain.toLowerCase().replace(/^www\./, '');
      if (hostname === customDomain) {
        return true;
      }
    }
    // Then check if we're on any tenant host (platform subdomain or unknown custom domain)
    return isOnTenantHost();
  }, [canonicalDomainContext?.customDomain]);

  return useMemo(() => {
    // Base path: empty for custom/tenant domains, /store/{tenantSlug} for app/legacy
    const basePath = isOnCustomDomain ? '' : `/store/${tenantSlug}`;
    
    return {
      home: () => basePath || '/',
      
      product: (productSlug: string | undefined) => {
        if (!hasValidSlug(productSlug)) return null;
        return `${basePath}/p/${productSlug}`;
      },
      
      category: (categorySlug: string | undefined) => {
        if (!hasValidSlug(categorySlug)) return null;
        return `${basePath}/c/${categorySlug}`;
      },
      
      cart: () => `${basePath}/cart`,
      
      checkout: () => `${basePath}/checkout`,
      
      thankYou: (orderNumber?: string) => {
        const base = `${basePath}/obrigado`;
        // Use 'pedido' param, normalize orderNumber (remove # for URL safety)
        const cleanOrderNumber = orderNumber?.replace(/^#/, '').trim();
        return cleanOrderNumber ? `${base}?pedido=${cleanOrderNumber}` : base;
      },
      
      page: (pageSlug: string | undefined) => {
        if (!hasValidSlug(pageSlug)) return null;
        return `${basePath}/page/${pageSlug}`;
      },
      
      landing: (landingSlug: string | undefined) => {
        if (!hasValidSlug(landingSlug)) return null;
        return `${basePath}/lp/${landingSlug}`;
      },
      
      account: () => `${basePath}/conta`,
      
      accountOrders: () => `${basePath}/conta/pedidos`,
      
      accountOrderDetail: (orderId: string) => `${basePath}/conta/pedidos/${orderId}`,
      
      buildMenuUrl: (
        item: { item_type: string; url?: string | null; ref_id?: string | null },
        categories?: Array<{ id: string; slug: string }>,
        pages?: Array<{ id: string; slug: string }>
      ): string => {
        // External URL - use as-is
        if (item.item_type === 'external' && item.url) {
          return item.url;
        }
        
        // Category reference
        if (item.item_type === 'category' && item.ref_id && categories) {
          const category = categories.find(c => c.id === item.ref_id);
          if (category) {
            return `${basePath}/c/${category.slug}`;
          }
        }
        
        // Page reference
        if (item.item_type === 'page' && item.ref_id && pages) {
          const page = pages.find(p => p.id === item.ref_id);
          if (page) {
            return `${basePath}/page/${page.slug}`;
          }
        }
        
        // Fallback to provided URL or home
        return item.url || basePath || '/';
      },
      
      isOnCustomDomain,
    };
  }, [tenantSlug, isOnCustomDomain]);
}

/**
 * Standalone function to get storefront base path (for use outside React context)
 * Returns empty string for tenant hosts, /store/{tenantSlug} for app/legacy
 */
export function getStorefrontBasePath(tenantSlug: string): string {
  if (isOnTenantHost()) {
    return '';
  }
  return `/store/${tenantSlug}`;
}
