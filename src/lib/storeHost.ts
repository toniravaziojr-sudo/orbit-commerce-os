/**
 * Resolves the store host for API calls (discount validation, etc.)
 * 
 * IMPORTANT: This is the single source of truth for store_host.
 * Always use getStoreHost() instead of manually building the host.
 * 
 * The host is used by the backend to resolve the tenant via tenant_domains table.
 */

/**
 * Returns the actual browser hostname (including port for localhost)
 * This is what the backend uses to resolve the tenant.
 * 
 * - Production custom domain: loja.respeiteohomem.com.br
 * - Production shops domain: tenant.shops.comandocentral.com.br
 * - Localhost: localhost:5173
 */
export function getStoreHost(): string {
  // Guard for SSR/pre-render
  if (typeof window === 'undefined') {
    return '';
  }
  
  // Use the actual browser host - the backend resolves tenant from this
  const host = window.location.host.toLowerCase().trim();
  
  return host;
}

/**
 * Returns just the hostname without port (for cases where backend expects hostname only)
 */
export function getStoreHostname(): string {
  const host = getStoreHost();
  if (!host) return '';
  
  // Remove port if present
  return host.split(':')[0];
}

/**
 * Checks if the current store host is valid for API calls
 */
export function isValidStoreHost(): boolean {
  const host = getStoreHost();
  return host.length > 0 && host !== 'undefined' && host !== 'null';
}
