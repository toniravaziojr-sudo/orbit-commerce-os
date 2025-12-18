// =============================================
// TENANT CANONICAL DOMAIN - Hook to fetch the primary active domain for a tenant
// Used in public storefront to determine the canonical URL
// =============================================

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CanonicalDomainInfo {
  domain: string | null;
  isLoading: boolean;
  hasCustomDomain: boolean;
}

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
 * The default public origin for the app (fallback when no custom domain)
 */
export const PUBLIC_APP_ORIGIN = 'https://orbit-commerce-os.lovable.app';

/**
 * Get the canonical origin for a tenant
 * Returns the custom domain if active, otherwise returns the app's default origin
 */
export function getTenantCanonicalOrigin(customDomain: string | null): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return PUBLIC_APP_ORIGIN;
}

/**
 * Get the full canonical base URL for a tenant's store
 */
export function getTenantPublicBaseUrl(tenantSlug: string, customDomain: string | null): string {
  const origin = getTenantCanonicalOrigin(customDomain);
  return `${origin}/store/${tenantSlug}`;
}

/**
 * Check if the current host matches the canonical domain
 * Returns true if no redirect is needed
 */
export function isCanonicalHost(currentHost: string, customDomain: string | null): boolean {
  if (!customDomain) {
    // No custom domain - the app's default host is canonical
    const appHost = new URL(PUBLIC_APP_ORIGIN).host;
    return currentHost === appHost;
  }
  // Custom domain exists - it should be the canonical host
  return currentHost === customDomain || currentHost === `www.${customDomain}`;
}

/**
 * Get the redirect URL if current host is not canonical
 * Returns null if no redirect is needed
 */
export function getCanonicalRedirectUrl(
  currentHost: string,
  currentPath: string,
  customDomain: string | null
): string | null {
  if (isCanonicalHost(currentHost, customDomain)) {
    return null; // Already on canonical host
  }

  const canonicalOrigin = getTenantCanonicalOrigin(customDomain);
  
  // Remove preview params from the redirect
  const url = new URL(currentPath, 'http://placeholder');
  url.searchParams.delete('preview');
  url.searchParams.delete('previewId');
  url.searchParams.delete('draft');
  
  const cleanPath = url.pathname + (url.search || '');
  return `${canonicalOrigin}${cleanPath}`;
}
