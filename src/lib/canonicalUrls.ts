// =============================================
// CANONICAL URLS - Full URL generation with domain support
// =============================================

import { hasValidSlug } from './slugValidation';
import { stripPreviewParams } from './sanitizePublicUrl';

/**
 * The default public origin for the app
 */
export const PUBLIC_APP_ORIGIN = 'https://orbit-commerce-os.lovable.app';

/**
 * Get the canonical origin for a tenant
 * @param customDomain - The custom domain if active (e.g., "loja.respeiteohomem.com.br")
 */
export function getCanonicalOrigin(customDomain: string | null): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return PUBLIC_APP_ORIGIN;
}

/**
 * Get the full canonical base URL for a store
 */
export function getCanonicalStoreBaseUrl(tenantSlug: string, customDomain: string | null): string {
  const origin = getCanonicalOrigin(customDomain);
  return `${origin}/store/${tenantSlug}`;
}

/**
 * Generate a full canonical URL for any store path
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
 */
export function isOnCanonicalHost(customDomain: string | null): boolean {
  const currentHost = window.location.host;
  
  if (!customDomain) {
    // No custom domain - app's default host is canonical
    const appHost = new URL(PUBLIC_APP_ORIGIN).host;
    return currentHost === appHost;
  }
  
  // Custom domain exists - check if we're on it
  return currentHost === customDomain || currentHost === `www.${customDomain}`;
}

/**
 * Get the URL to redirect to for canonical domain
 * Returns null if already on canonical host
 */
export function getCanonicalRedirect(
  tenantSlug: string,
  customDomain: string | null
): string | null {
  if (isOnCanonicalHost(customDomain)) {
    return null;
  }

  const canonicalOrigin = getCanonicalOrigin(customDomain);
  const currentPath = window.location.pathname;
  
  // Clean query params (remove preview)
  const cleanParams = stripPreviewParams(new URLSearchParams(window.location.search));
  const queryString = cleanParams.toString();
  
  return `${canonicalOrigin}${currentPath}${queryString ? `?${queryString}` : ''}`;
}
