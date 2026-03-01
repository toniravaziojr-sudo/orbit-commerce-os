// =============================================
// CANONICAL DOMAIN SERVICE
// Central service for resolving tenant canonical domains and URLs
// Follows SaaS pattern: tenant subdomains + custom domains
// =============================================

import { supabase } from '@/integrations/supabase/client';

// SaaS Platform Configuration
export const SAAS_CONFIG = {
  // The main SaaS domain
  domain: 'comandocentral.com.br',
  // Subdomain for storefronts (tenantSlug.shops.domain)
  storefrontSubdomain: 'shops',
  // Subdomain for admin app
  appSubdomain: 'app',
  // Fallback origin for legacy/development
  fallbackOrigin: 'https://app.comandocentral.com.br',
  // Target hostname for Cloudflare Custom Hostnames
  targetHostname: 'shops.comandocentral.com.br',
} as const;

// =============================================
// PUBLIC HOSTNAME DETECTION
// =============================================

/**
 * Get the public hostname, respecting X-Forwarded-Host when behind a proxy (Cloudflare Worker)
 * Falls back to window.location.hostname for direct access
 */
export function getPublicHostname(): string {
  // In browser context, we need to check if we're behind a proxy
  // The Worker sets X-Forwarded-Host, but we can't read HTTP headers in browser JS
  // Instead, we need to rely on the URL that the browser sees
  
  // For platform subdomains served via Worker, the browser URL should already show the tenant host
  // If it shows the origin (lovable.app), we need to use other indicators
  
  const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // If already on a platform subdomain or custom domain, use it directly
  if (isPlatformSubdomain(currentHost)) {
    return currentHost;
  }
  
  // If on app.comandocentral.com.br, return as-is (admin context)
  if (currentHost === `${SAAS_CONFIG.appSubdomain}.${SAAS_CONFIG.domain}`) {
    return currentHost;
  }
  
  return currentHost;
}

// =============================================
// URL BUILDING UTILITIES
// =============================================

/**
 * Get the platform subdomain URL for a tenant
 * Format: https://tenantSlug.shops.comandocentral.com.br
 */
export function getPlatformSubdomainUrl(tenantSlug: string): string {
  return `https://${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}`;
}

/**
 * Get the app/admin URL
 * Format: https://app.comandocentral.com.br
 */
export function getAppUrl(): string {
  return `https://${SAAS_CONFIG.appSubdomain}.${SAAS_CONFIG.domain}`;
}

/**
 * Check if a hostname is a platform subdomain
 */
export function isPlatformSubdomain(hostname: string): boolean {
  const pattern = new RegExp(
    `^[a-z0-9-]+\\.${SAAS_CONFIG.storefrontSubdomain}\\.${SAAS_CONFIG.domain.replace(/\./g, '\\.')}$`,
    'i'
  );
  return pattern.test(hostname.replace(/^www\./, ''));
}

/**
 * Check if the current host is the app domain
 */
export function isAppDomain(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
  return (
    normalizedHostname === `${SAAS_CONFIG.appSubdomain}.${SAAS_CONFIG.domain}` ||
    normalizedHostname === 'orbit-commerce-os.lovable.app' ||
    normalizedHostname.endsWith('.lovableproject.com') ||
    normalizedHostname.endsWith('.lovable.app')
  );
}

/**
 * Extract tenant slug from platform subdomain
 */
export function extractTenantFromPlatformSubdomain(hostname: string): string | null {
  const pattern = new RegExp(
    `^([a-z0-9-]+)\\.${SAAS_CONFIG.storefrontSubdomain}\\.${SAAS_CONFIG.domain.replace(/\./g, '\\.')}$`,
    'i'
  );
  const match = hostname.replace(/^www\./, '').match(pattern);
  return match ? match[1] : null;
}

// =============================================
// CANONICAL DOMAIN RESOLUTION
// =============================================

export interface CanonicalDomainInfo {
  tenantSlug: string;
  tenantId: string;
  canonicalOrigin: string;
  currentDomainType: 'platform_subdomain' | 'custom' | 'legacy';
  isPrimary: boolean;
  shouldRedirect: boolean;
  redirectUrl?: string;
}

/**
 * Resolve the canonical domain for a request
 * This is the main entry point for storefront domain resolution
 */
export async function resolveCanonicalDomain(
  currentHostname: string,
  currentPath: string = '/',
  searchParams?: URLSearchParams
): Promise<CanonicalDomainInfo | null> {
  const normalizedHostname = currentHostname.toLowerCase().replace(/^www\./, '');
  
  // Skip resolution for app domain
  if (isAppDomain(normalizedHostname)) {
    return null;
  }

  try {
    // Call the resolve-domain edge function
    const { data, error } = await supabase.functions.invoke('resolve-domain', {
      body: { hostname: normalizedHostname },
    });

    if (error || !data?.found) {
      console.log('[CanonicalDomainService] Domain not found:', normalizedHostname);
      return null;
    }

    const result: CanonicalDomainInfo = {
      tenantSlug: data.tenant_slug,
      tenantId: data.tenant_id,
      canonicalOrigin: data.canonical_origin,
      currentDomainType: data.domain_type || 'legacy',
      isPrimary: data.is_primary ?? true,
      shouldRedirect: false,
    };

    // Determine if redirect is needed
    const currentOrigin = `https://${normalizedHostname}`;
    if (currentOrigin !== data.canonical_origin) {
      result.shouldRedirect = true;
      
      // Build redirect URL, removing preview params
      const cleanParams = new URLSearchParams(searchParams || '');
      cleanParams.delete('preview');
      cleanParams.delete('previewId');
      cleanParams.delete('draft');
      
      const queryString = cleanParams.toString();
      result.redirectUrl = `${data.canonical_origin}${currentPath}${queryString ? `?${queryString}` : ''}`;
    }

    return result;

  } catch (error) {
    console.error('[CanonicalDomainService] Error resolving domain:', error);
    return null;
  }
}

/**
 * Get the canonical origin for a tenant (sync version using cached data)
 */
export function getCanonicalOrigin(
  customDomain: string | null,
  tenantSlug: string
): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return getPlatformSubdomainUrl(tenantSlug);
}

/**
 * Get the canonical base URL for a tenant's store
 * This returns the root URL where the storefront lives
 * 
 * IMPORTANT: Always returns the platform subdomain or custom domain URL.
 * Links in storefronts should ALWAYS point to the canonical tenant URL,
 * not the legacy app domain.
 */
export function getCanonicalStoreUrl(
  customDomain: string | null,
  tenantSlug: string
): string {
  // If custom domain exists and is active, use it
  if (customDomain) {
    return `https://${customDomain}`;
  }
  
  // Default to platform subdomain (the SaaS model)
  // This ensures links always point to {tenant}.shops.comandocentral.com.br
  return getPlatformSubdomainUrl(tenantSlug);
}

// =============================================
// PUBLIC URL GENERATORS (for storefront links)
// =============================================

/**
 * Generate a public product URL
 */
export function getPublicProductUrl(
  tenantSlug: string,
  productSlug: string,
  customDomain: string | null = null
): string {
  const base = getCanonicalStoreUrl(customDomain, tenantSlug);
  return `${base}/p/${productSlug}`;
}

/**
 * Generate a public category URL
 */
export function getPublicCategoryUrl(
  tenantSlug: string,
  categorySlug: string,
  customDomain: string | null = null
): string {
  const base = getCanonicalStoreUrl(customDomain, tenantSlug);
  return `${base}/c/${categorySlug}`;
}

/**
 * Generate a public page URL
 */
export function getPublicPageUrl(
  tenantSlug: string,
  pageSlug: string,
  customDomain: string | null = null
): string {
  const base = getCanonicalStoreUrl(customDomain, tenantSlug);
  return `${base}/page/${pageSlug}`;
}

/**
 * Generate the cart URL
 */
export function getPublicCartUrl(
  tenantSlug: string,
  customDomain: string | null = null
): string {
  const base = getCanonicalStoreUrl(customDomain, tenantSlug);
  return `${base}/cart`;
}

/**
 * Generate the checkout URL
 */
export function getPublicCheckoutUrl(
  tenantSlug: string,
  customDomain: string | null = null
): string {
  const base = getCanonicalStoreUrl(customDomain, tenantSlug);
  return `${base}/checkout`;
}

/**
 * Generate the thank you URL
 */
export function getPublicThankYouUrl(
  tenantSlug: string,
  orderNumber: string,
  customDomain: string | null = null
): string {
  const base = getCanonicalStoreUrl(customDomain, tenantSlug);
  return `${base}/obrigado?order=${orderNumber}`;
}

/**
 * Generate the home URL
 */
export function getPublicHomeUrl(
  tenantSlug: string,
  customDomain: string | null = null
): string {
  return getCanonicalStoreUrl(customDomain, tenantSlug);
}

// =============================================
// TENANT CANONICAL DOMAIN HOOK DATA
// =============================================

export interface TenantCanonicalInfo {
  platformSubdomainUrl: string;
  customDomain: string | null;
  canonicalOrigin: string;
  hasCustomDomain: boolean;
}

/**
 * Fetch the canonical domain info for a tenant
 * Returns both the platform subdomain and any active custom domain
 */
export async function fetchTenantCanonicalInfo(
  tenantId: string,
  tenantSlug: string
): Promise<TenantCanonicalInfo> {
  const platformSubdomainUrl = getPlatformSubdomainUrl(tenantSlug);
  
  try {
    const { data, error } = await supabase
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', tenantId)
      .eq('type', 'custom')
      .eq('is_primary', true)
      .eq('status', 'verified')
      .eq('ssl_status', 'active')
      .single();

    if (error || !data) {
      return {
        platformSubdomainUrl,
        customDomain: null,
        canonicalOrigin: platformSubdomainUrl,
        hasCustomDomain: false,
      };
    }

    return {
      platformSubdomainUrl,
      customDomain: data.domain,
      canonicalOrigin: `https://${data.domain}`,
      hasCustomDomain: true,
    };
  } catch (err) {
    console.error('[fetchTenantCanonicalInfo] Error:', err);
    return {
      platformSubdomainUrl,
      customDomain: null,
      canonicalOrigin: platformSubdomainUrl,
      hasCustomDomain: false,
    };
  }
}
