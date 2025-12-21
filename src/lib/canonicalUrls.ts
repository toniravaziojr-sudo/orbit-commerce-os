// =============================================
// CANONICAL URLS - Full URL generation with domain support
// URLs are CLEAN (without /store/{tenant}) for custom domains and platform subdomains
// =============================================

import { hasValidSlug } from './slugValidation';
import { stripPreviewParams } from './sanitizePublicUrl';
import { 
  SAAS_CONFIG, 
  isPlatformSubdomain, 
  getPlatformSubdomainUrl,
} from './canonicalDomainService';

/**
 * The default public origin for the app (legacy fallback)
 */
export const PUBLIC_APP_ORIGIN = SAAS_CONFIG.fallbackOrigin;

/**
 * Get the canonical origin for a tenant
 * @param customDomain - The custom domain if active (e.g., "loja.respeiteohomem.com.br")
 * @param tenantSlug - Optional tenant slug for generating platform subdomain URL
 */
export function getCanonicalOrigin(customDomain: string | null, tenantSlug?: string): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  // If tenant slug is provided, use the platform subdomain
  if (tenantSlug) {
    return getPlatformSubdomainUrl(tenantSlug);
  }
  return PUBLIC_APP_ORIGIN;
}

/**
 * Get the full canonical base URL for a store
 * IMPORTANT: For custom domains and platform subdomains, returns just the origin (clean URL)
 * Only legacy app domain paths use /store/{tenantSlug}
 */
export function getCanonicalStoreBaseUrl(tenantSlug: string, customDomain: string | null): string {
  const origin = getCanonicalOrigin(customDomain, tenantSlug);
  
  // For custom domains, return just the origin (clean URL, no /store/tenant)
  if (customDomain) {
    return origin;
  }
  
  // For platform subdomains (tenant.shops.domain), return just the origin (clean URL)
  if (tenantSlug && origin.includes(`${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}`)) {
    return origin;
  }
  
  // Only for legacy/fallback origin, use /store/{tenantSlug}
  return `${origin}/store/${tenantSlug}`;
}

/**
 * Generate a full canonical URL for any store path
 * Uses clean paths for custom/platform domains
 */
export function getCanonicalUrl(
  tenantSlug: string,
  path: string,
  customDomain: string | null
): string {
  const baseUrl = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  if (!path || path === '/') {
    return baseUrl;
  }
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Generate canonical home URL
 */
export function getCanonicalHomeUrl(
  tenantSlug: string,
  customDomain: string | null
): string {
  return getCanonicalStoreBaseUrl(tenantSlug, customDomain);
}

/**
 * Generate canonical product URL
 */
export function getCanonicalProductUrl(
  tenantSlug: string,
  productSlug: string | undefined,
  customDomain: string | null
): string | null {
  if (!hasValidSlug(productSlug)) return null;
  return getCanonicalUrl(tenantSlug, `/p/${productSlug}`, customDomain);
}

/**
 * Generate canonical category URL
 */
export function getCanonicalCategoryUrl(
  tenantSlug: string,
  categorySlug: string | undefined,
  customDomain: string | null
): string | null {
  if (!hasValidSlug(categorySlug)) return null;
  return getCanonicalUrl(tenantSlug, `/c/${categorySlug}`, customDomain);
}

/**
 * Generate canonical page URL
 */
export function getCanonicalPageUrl(
  tenantSlug: string,
  pageSlug: string | undefined,
  customDomain: string | null
): string | null {
  if (!hasValidSlug(pageSlug)) return null;
  return getCanonicalUrl(tenantSlug, `/page/${pageSlug}`, customDomain);
}

/**
 * Generate canonical cart URL
 */
export function getCanonicalCartUrl(tenantSlug: string, customDomain: string | null): string {
  return getCanonicalUrl(tenantSlug, '/cart', customDomain);
}

/**
 * Generate canonical checkout URL
 */
export function getCanonicalCheckoutUrl(tenantSlug: string, customDomain: string | null): string {
  return getCanonicalUrl(tenantSlug, '/checkout', customDomain);
}

/**
 * Generate canonical thank-you URL
 */
export function getCanonicalThankYouUrl(tenantSlug: string, customDomain: string | null): string {
  return getCanonicalUrl(tenantSlug, '/obrigado', customDomain);
}

/**
 * Check if current host matches the expected canonical host
 * 
 * IMPORTANT: The fallback origin (lovable.app) is NEVER canonical for production.
 * Only platform subdomains or verified custom domains are canonical.
 */
export function isOnCanonicalHost(customDomain: string | null, tenantSlug?: string): boolean {
  const currentHost = window.location.host.toLowerCase().replace(/^www\./, '');
  
  // Check if we're on a platform subdomain
  if (isPlatformSubdomain(currentHost)) {
    // If no custom domain, platform subdomain is canonical
    if (!customDomain) {
      return true;
    }
    // If custom domain exists, it's the canonical - we should redirect
    return false;
  }
  
  // Check if we're on the custom domain
  if (customDomain) {
    const normalizedCustom = customDomain.toLowerCase().replace(/^www\./, '');
    return currentHost === normalizedCustom;
  }
  
  // Fallback origin (lovable.app) and app domain are NOT canonical for storefronts
  // They should redirect to the proper tenant subdomain
  return false;
}

/**
 * Get the URL to redirect to for canonical domain
 * Returns null if already on canonical host
 */
export function getCanonicalRedirect(
  tenantSlug: string,
  customDomain: string | null
): string | null {
  if (isOnCanonicalHost(customDomain, tenantSlug)) {
    return null;
  }

  const canonicalOrigin = getCanonicalOrigin(customDomain, tenantSlug);
  const currentPath = window.location.pathname;
  
  // Clean query params (remove preview)
  const cleanParams = stripPreviewParams(new URLSearchParams(window.location.search));
  const queryString = cleanParams.toString();
  
  return `${canonicalOrigin}${currentPath}${queryString ? `?${queryString}` : ''}`;
}
