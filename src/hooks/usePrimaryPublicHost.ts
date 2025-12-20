// =============================================
// USE PRIMARY PUBLIC HOST - Hook to get the canonical public host for a tenant
// Returns the primary public host (custom domain if active, else platform subdomain)
// For use in admin to generate correct public links
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  SAAS_CONFIG,
  getPlatformSubdomainUrl,
} from '@/lib/canonicalDomainService';

export interface PrimaryPublicHostInfo {
  /** The primary public host (e.g., "loja.cliente.com" or "tenant.shops.comandocentral.com.br") */
  primaryHost: string;
  /** Full URL origin (e.g., "https://loja.cliente.com") */
  primaryOrigin: string;
  /** Whether the primary is a custom domain (true) or platform subdomain (false) */
  hasCustomDomain: boolean;
  /** The platform subdomain URL (always available) */
  platformSubdomainUrl: string;
  /** The custom domain if active */
  customDomain: string | null;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Hook to get the primary public host for a tenant
 * Use this in admin pages to generate correct public URLs
 */
export function usePrimaryPublicHost(tenantId: string | undefined, tenantSlug: string | undefined): PrimaryPublicHostInfo {
  const platformSubdomainUrl = tenantSlug 
    ? getPlatformSubdomainUrl(tenantSlug) 
    : '';
  
  const platformHost = tenantSlug 
    ? `${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}` 
    : '';

  const { data, isLoading } = useQuery({
    queryKey: ['primary-public-host', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      // Fetch the primary custom domain if exists
      const { data: domain, error } = await supabase
        .from('tenant_domains')
        .select('domain')
        .eq('tenant_id', tenantId)
        .eq('type', 'custom')
        .eq('is_primary', true)
        .eq('status', 'verified')
        .eq('ssl_status', 'active')
        .maybeSingle();
      
      if (error) {
        console.error('[usePrimaryPublicHost] Error fetching primary domain:', error);
        return null;
      }
      
      return domain?.domain || null;
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    enabled: !!tenantId,
  });

  const customDomain = data || null;
  const hasCustomDomain = !!customDomain;
  const primaryHost = customDomain || platformHost;
  const primaryOrigin = primaryHost ? `https://${primaryHost}` : '';

  return {
    primaryHost,
    primaryOrigin,
    hasCustomDomain,
    platformSubdomainUrl,
    customDomain,
    isLoading,
  };
}

/**
 * Generate a public storefront URL using the primary public host
 * Use this for all "Open" and "Copy" buttons in admin
 * 
 * @param primaryOrigin - The primary origin (from usePrimaryPublicHost)
 * @param path - The path to append (e.g., "/p/product-slug")
 */
export function buildPublicStorefrontUrl(primaryOrigin: string, path: string = '/'): string {
  if (!primaryOrigin) return '';
  
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Remove any /store/{tenant} prefix from path if present
  const pathWithoutLegacyPrefix = cleanPath.replace(/^\/store\/[^/]+/, '');
  
  return `${primaryOrigin}${pathWithoutLegacyPrefix || '/'}`;
}
