// =============================================
// TENANT CANONICAL DOMAIN - Hook to fetch the primary active domain for a tenant
// Used in public storefront to determine the canonical URL
// =============================================

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  SAAS_CONFIG, 
  isPlatformSubdomain, 
  getPlatformSubdomainUrl,
  extractTenantFromPlatformSubdomain,
} from '@/lib/canonicalDomainService';

export interface CanonicalDomainInfo {
  domain: string | null;
  isLoading: boolean;
  hasCustomDomain: boolean;
}

/**
 * The default public origin for the app (legacy fallback)
 */
export const PUBLIC_APP_ORIGIN = SAAS_CONFIG.fallbackOrigin;

/**
 * Fetch the primary active domain for a tenant (public context)
 * Returns the custom domain if it exists and is active, null otherwise
 */
export function useTenantCanonicalDomain(tenantId: string | undefined): CanonicalDomainInfo {
  const [domain, setDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setDomain(null);
      setIsLoading(false);
      return;
    }

    const fetchPrimaryDomain = async () => {
      try {
        const { data, error } = await supabase
          .from('tenant_domains')
          .select('domain')
          .eq('tenant_id', tenantId)
          .eq('is_primary', true)
          .eq('status', 'verified')
          .eq('ssl_status', 'active')
          .single();

        if (error || !data) {
          setDomain(null);
        } else {
          setDomain(data.domain);
        }
      } catch (err) {
        console.error('[useTenantCanonicalDomain] Error:', err);
        setDomain(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrimaryDomain();
  }, [tenantId]);

  return {
    domain,
    isLoading,
    hasCustomDomain: !!domain,
  };
}

// =============================================
// CANONICAL URL UTILITIES
// =============================================

/**
 * Get the canonical origin for a tenant
 * Returns the custom domain if active, otherwise returns the platform subdomain
 */
export function getTenantCanonicalOrigin(customDomain: string | null, tenantSlug?: string): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  // Use platform subdomain if tenantSlug is provided
  if (tenantSlug) {
    return getPlatformSubdomainUrl(tenantSlug);
  }
  return PUBLIC_APP_ORIGIN;
}

/**
 * Get the full canonical base URL for a tenant's store
 * NOTE: For platform subdomain and custom domains, the path is just the origin (no /store/{slug})
 */
export function getTenantPublicBaseUrl(tenantSlug: string, customDomain: string | null): string {
  const origin = getTenantCanonicalOrigin(customDomain, tenantSlug);
  
  // For custom domain or platform subdomain, just return the origin (domain-aware routing)
  if (customDomain) {
    return origin;
  }
  
  // For platform subdomain, also just return the origin
  if (tenantSlug && origin.includes(`${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}`)) {
    return origin;
  }
  
  // Only for legacy/fallback origin, use /store/{tenantSlug}
  return `${origin}/store/${tenantSlug}`;
}

/**
 * Check if the current host is valid for storefront (platform subdomain, custom domain, or legacy for dev)
 * Note: Legacy origin (lovable.app) is only valid for development/preview
 */
export function isValidStorefrontHost(currentHost: string, customDomain: string | null, tenantSlug?: string): boolean {
  const normalizedHost = currentHost.toLowerCase().replace(/^www\./, '');
  
  // Check if it's a platform subdomain (*.shops.comandocentral.com.br)
  if (isPlatformSubdomain(normalizedHost)) {
    // If tenant slug is provided, verify it matches
    if (tenantSlug) {
      const extractedSlug = extractTenantFromPlatformSubdomain(normalizedHost);
      return extractedSlug === tenantSlug;
    }
    return true;
  }
  
  // Check if it's the custom domain
  if (customDomain) {
    const normalizedCustom = customDomain.toLowerCase().replace(/^www\./, '');
    if (normalizedHost === normalizedCustom || normalizedHost === `www.${normalizedCustom}`) {
      return true;
    }
  }
  
  // Check if it's the app domain (for admin preview access)
  if (normalizedHost === `${SAAS_CONFIG.appSubdomain}.${SAAS_CONFIG.domain}`) {
    return true;
  }
  
  // Legacy/fallback origin is valid ONLY for development access via Lovable preview
  const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).host;
  return normalizedHost === fallbackHost;
}

/**
 * Check if the current host matches the canonical domain
 * Returns true if no redirect is needed
 * 
 * IMPORTANT: The fallback origin (lovable.app) is NEVER canonical for production.
 * Only platform subdomains or verified custom domains are canonical.
 */
export function isCanonicalHost(currentHost: string, customDomain: string | null, tenantSlug?: string): boolean {
  const normalizedHost = currentHost.toLowerCase().replace(/^www\./, '');
  
  // If there's a custom domain marked as primary, that's the canonical host
  if (customDomain) {
    const normalizedCustom = customDomain.toLowerCase().replace(/^www\./, '');
    return normalizedHost === normalizedCustom || normalizedHost === `www.${normalizedCustom}`;
  }
  
  // If no custom domain, the platform subdomain is canonical
  if (tenantSlug) {
    const platformHost = `${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}`;
    if (normalizedHost === platformHost) {
      return true;
    }
  }
  
  // Check if on platform subdomain (always valid if no custom domain)
  if (isPlatformSubdomain(normalizedHost)) {
    return true;
  }
  
  // IMPORTANT: Fallback origin (lovable.app) and app domain are NOT canonical for storefronts
  // They should redirect to the proper tenant subdomain
  return false;
}

/**
 * Get the redirect URL if current host is not canonical
 * Returns null if no redirect is needed
 */
export function getCanonicalRedirectUrl(
  currentHost: string,
  currentPath: string,
  customDomain: string | null,
  tenantSlug?: string
): string | null {
  if (isCanonicalHost(currentHost, customDomain, tenantSlug)) {
    return null; // Already on canonical host
  }

  const canonicalOrigin = getTenantCanonicalOrigin(customDomain, tenantSlug);
  
  // Remove preview params from the redirect
  const url = new URL(currentPath, 'http://placeholder');
  url.searchParams.delete('preview');
  url.searchParams.delete('previewId');
  url.searchParams.delete('draft');
  
  const cleanPath = url.pathname + (url.search || '');
  return `${canonicalOrigin}${cleanPath}`;
}
