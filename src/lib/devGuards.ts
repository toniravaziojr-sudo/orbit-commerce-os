/**
 * DEV-ONLY RUNTIME SAFEGUARDS
 * 
 * These functions provide warnings during development when code
 * generates URLs that would break on custom domains.
 * 
 * IMPORTANT: These only run in development mode and have no
 * effect in production builds.
 */

import { isPlatformSubdomain, isAppDomain } from '@/lib/canonicalDomainService';

/**
 * Check if we're on a custom domain (not app domain, not platform subdomain in dev)
 */
function isOnCustomDomainDev(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // If on platform subdomain → not custom domain
  if (isPlatformSubdomain(hostname)) {
    return false;
  }
  
  // If on app domain → not custom domain
  if (isAppDomain(hostname)) {
    return false;
  }
  
  // If localhost → simulate custom domain behavior for testing
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }
  
  return true;
}

/**
 * Validate that a generated URL doesn't contain /store/{slug} patterns
 * that would break on custom domains.
 * 
 * Only logs warnings in development mode.
 */
export function warnIfInvalidStorefrontUrl(url: string, context?: string): void {
  // Only run in development
  if (import.meta.env.PROD) return;
  
  // Check for prohibited patterns
  const hasStoreSlug = /\/store\/[^/]+/.test(url);
  const hasAppDomain = url.includes('app.comandocentral');
  
  if (!hasStoreSlug && !hasAppDomain) return;
  
  // Check if we're on a custom domain (or simulating one)
  const isCustom = isOnCustomDomainDev();
  
  if (isCustom && hasStoreSlug) {
    console.warn(
      `⚠️ [DEV GUARD] Invalid storefront URL detected!\n` +
      `   URL: "${url}"\n` +
      `   Problem: Contains /store/{slug} but we're on a custom domain.\n` +
      `   Context: ${context || 'unknown'}\n` +
      `   Fix: Use useStorefrontUrls() helper instead of hardcoding paths.\n` +
      `   Docs: docs/ANTI_REGRESSION_CHECKLIST.md`
    );
  }
  
  if (hasAppDomain) {
    console.warn(
      `⚠️ [DEV GUARD] Public URL pointing to app domain!\n` +
      `   URL: "${url}"\n` +
      `   Problem: Public storefront links should never point to app.comandocentral.com.br\n` +
      `   Context: ${context || 'unknown'}\n` +
      `   Fix: Use useStorefrontUrls() helper to generate domain-aware URLs.`
    );
  }
}

/**
 * Validate a navigate() target before navigation
 */
export function validateNavigateTarget(path: string, context?: string): void {
  warnIfInvalidStorefrontUrl(path, context || 'navigate()');
}

/**
 * Validate a Link 'to' prop
 */
export function validateLinkTo(to: string, context?: string): void {
  warnIfInvalidStorefrontUrl(to, context || '<Link to=...>');
}

/**
 * Wrap a URL generator to add dev-time validation
 */
export function withDevValidation<T extends (...args: unknown[]) => string>(
  fn: T,
  context: string
): T {
  if (import.meta.env.PROD) return fn;
  
  return ((...args: unknown[]) => {
    const result = fn(...args);
    warnIfInvalidStorefrontUrl(result, context);
    return result;
  }) as T;
}
