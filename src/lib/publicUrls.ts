// =============================================
// PUBLIC URLS - Central URL builder for all public storefront routes
// Single source of truth for all public URL generation
// =============================================

import { hasValidSlug } from './slugValidation';
import { 
  SAAS_CONFIG, 
  getPlatformSubdomainUrl,
  isPlatformSubdomain,
  isAppDomain,
} from './canonicalDomainService';

/**
 * The default public origin for the app (legacy fallback)
 */
export const PUBLIC_APP_ORIGIN = SAAS_CONFIG.fallbackOrigin;

/**
 * Check if we're currently on a tenant-specific host (custom domain or platform subdomain)
 * where paths should NOT include /store/{tenantSlug}
 */
function isOnTenantHost(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // If on platform subdomain (tenant.shops.comandocentral.com.br) → tenant host
  if (isPlatformSubdomain(hostname)) {
    return true;
  }
  
  // If NOT on app domain and NOT on fallback origin → likely custom domain
  // But exclude development/preview domains (lovableproject.com, lovable.app, localhost)
  if (!isAppDomain(hostname)) {
    // Exclude known dev/preview domains
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    if (hostname.endsWith('.lovableproject.com')) return false;
    if (hostname.endsWith('.lovable.app')) return false;
    
    const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).hostname;
    if (hostname !== fallbackHost) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the canonical origin for a tenant
 * @param customDomain - The custom domain if active (e.g., "loja.respeiteohomem.com.br")
 * @param tenantSlug - Optional tenant slug for generating platform subdomain URL
 */
export function getCanonicalOrigin(customDomain: string | null | undefined, tenantSlug?: string): string {
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
 * Get the base URL for a store (relative path only, for internal navigation)
 * 
 * IMPORTANT: When on a custom domain or platform subdomain, returns empty string
 * so paths are relative to root (e.g., /p/product instead of /store/tenant/p/product)
 */
export function getStoreBaseUrl(tenantSlug: string): string {
  if (!tenantSlug) {
    if (import.meta.env.DEV) {
      console.warn('[publicUrls] getStoreBaseUrl called without tenantSlug');
    }
    return '/store';
  }
  
  // When on tenant host (custom domain or platform subdomain), use root paths
  if (isOnTenantHost()) {
    return '';
  }
  
  // When on app/legacy domain, use /store/{tenantSlug} paths
  return `/store/${tenantSlug}`;
}

/**
 * Get the full canonical base URL for a store (absolute URL with domain)
 * NOTE: For custom/platform domains, the path is just the origin (no /store/{slug})
 */
export function getCanonicalStoreBaseUrl(tenantSlug: string, customDomain: string | null | undefined): string {
  const origin = getCanonicalOrigin(customDomain, tenantSlug);
  // On custom domain or platform subdomain, don't add /store/{tenantSlug}
  if (customDomain || (tenantSlug && origin.includes(`${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}`))) {
    return origin;
  }
  return `${origin}/store/${tenantSlug}`;
}

/**
 * Get the public home URL
 */
export function getPublicHomeUrl(tenantSlug: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  return preview ? `${base}?preview=1` : base;
}

/**
 * Get the public product URL
 * @param tenantSlug - The tenant slug
 * @param productSlug - The product slug/handle (required - if empty/invalid, returns null)
 */
export function getPublicProductUrl(tenantSlug: string, productSlug: string | undefined, preview = false): string | null {
  if (!hasValidSlug(productSlug)) {
    if (import.meta.env.DEV && productSlug !== undefined) {
      console.warn(`[publicUrls] getPublicProductUrl: invalid slug "${productSlug}"`);
    }
    return null;
  }
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/p/${productSlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public category URL
 * @param tenantSlug - The tenant slug
 * @param categorySlug - The category slug (required - if empty/invalid, returns null)
 */
export function getPublicCategoryUrl(tenantSlug: string, categorySlug: string | undefined, preview = false): string | null {
  if (!hasValidSlug(categorySlug)) {
    if (import.meta.env.DEV && categorySlug !== undefined) {
      console.warn(`[publicUrls] getPublicCategoryUrl: invalid slug "${categorySlug}"`);
    }
    return null;
  }
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/c/${categorySlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public cart URL
 */
export function getPublicCartUrl(tenantSlug: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/cart`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public checkout URL
 */
export function getPublicCheckoutUrl(tenantSlug: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/checkout`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public thank you URL
 */
export function getPublicThankYouUrl(tenantSlug: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/obrigado`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public institutional page URL
 * @param tenantSlug - The tenant slug
 * @param pageSlug - The page slug (required - if empty/invalid, returns null)
 */
export function getPublicPageUrl(tenantSlug: string, pageSlug: string | undefined, preview = false): string | null {
  if (!hasValidSlug(pageSlug)) {
    if (import.meta.env.DEV && pageSlug !== undefined) {
      console.warn(`[publicUrls] getPublicPageUrl: invalid slug "${pageSlug}"`);
    }
    return null;
  }
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/page/${pageSlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public landing page URL
 * @param tenantSlug - The tenant slug
 * @param landingSlug - The landing page slug (required - if empty/invalid, returns null)
 */
export function getPublicLandingUrl(tenantSlug: string, landingSlug: string | undefined, preview = false): string | null {
  if (!hasValidSlug(landingSlug)) {
    if (import.meta.env.DEV && landingSlug !== undefined) {
      console.warn(`[publicUrls] getPublicLandingUrl: invalid slug "${landingSlug}"`);
    }
    return null;
  }
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/lp/${landingSlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public account hub URL
 */
export function getPublicAccountUrl(tenantSlug: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/conta`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public account orders list URL
 */
export function getPublicAccountOrdersUrl(tenantSlug: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/conta/pedidos`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public account order detail URL
 */
export function getPublicAccountOrderDetailUrl(tenantSlug: string, orderId?: string, preview = false): string {
  const base = getStoreBaseUrl(tenantSlug);
  const url = orderId ? `${base}/conta/pedidos/${orderId}` : `${base}/conta/pedidos/:orderId`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public "My Orders" URL (legacy alias)
 */
export function getPublicMyOrdersUrl(tenantSlug: string): string {
  return `${getStoreBaseUrl(tenantSlug)}/conta/pedidos`;
}

/**
 * Build menu item URL based on item type and reference
 * @param tenantSlug - The tenant slug
 * @param item - The menu item with type, url, ref_id
 * @param categories - List of categories for resolving category refs
 * @param pages - List of pages for resolving page refs
 */
export function buildMenuItemUrl(
  tenantSlug: string,
  item: {
    item_type: string;
    url?: string | null;
    ref_id?: string | null;
  },
  categories?: Array<{ id: string; slug: string }>,
  pages?: Array<{ id: string; slug: string; type?: string | null }>
): string {
  const baseUrl = getStoreBaseUrl(tenantSlug);

  // External URL
  if (item.item_type === 'external' && item.url) {
    return item.url;
  }

  // Category reference
  if (item.item_type === 'category' && item.ref_id && categories) {
    const category = categories.find(c => c.id === item.ref_id);
    if (category) {
      const url = getPublicCategoryUrl(tenantSlug, category.slug);
      return url || baseUrl;
    }
  }

  // Page reference (institutional or landing)
  if (item.item_type === 'page' && item.ref_id && pages) {
    const page = pages.find(p => p.id === item.ref_id);
    if (page) {
      // Check if it's a landing page
      if (page.type === 'landing_page') {
        const url = getPublicLandingUrl(tenantSlug, page.slug);
        return url || baseUrl;
      }
      // Default to institutional page
      const url = getPublicPageUrl(tenantSlug, page.slug);
      return url || baseUrl;
    }
  }

  // Blog - standard route
  if (item.item_type === 'blog') {
    return `${baseUrl}/blog`;
  }

  // Tracking - standard route
  if (item.item_type === 'tracking') {
    return `${baseUrl}/rastreio`;
  }

  // Fallback to provided URL or base
  return item.url || baseUrl;
}

/**
 * Result type for getPreviewUrlForEditor
 */
export interface PreviewUrlResult {
  url: string | null;
  canPreview: boolean;
  reason?: string;
}

/**
 * Get preview URL for editor context with validation
 * @param tenantSlug - The tenant slug
 * @param pageType - The page type being edited
 * @param entitySlug - Optional slug of the specific entity (product/category/page)
 */
export function getPreviewUrlForEditor(
  tenantSlug: string,
  pageType: string,
  entitySlug?: string
): string {
  // For pages that require slug, if no slug is provided, return home with warning
  switch (pageType) {
    case 'home':
      return getPublicHomeUrl(tenantSlug, true);
    case 'product':
      if (entitySlug) {
        const url = getPublicProductUrl(tenantSlug, entitySlug, true);
        if (url) return url;
      }
      // No product selected - return home (toolbar should disable button)
      return getPublicHomeUrl(tenantSlug, true);
    case 'category':
      if (entitySlug) {
        const url = getPublicCategoryUrl(tenantSlug, entitySlug, true);
        if (url) return url;
      }
      // No category selected - return home (toolbar should disable button)
      return getPublicHomeUrl(tenantSlug, true);
    case 'cart':
      return getPublicCartUrl(tenantSlug, true);
    case 'checkout':
      return getPublicCheckoutUrl(tenantSlug, true);
    case 'thank_you':
    case 'obrigado':
      return getPublicThankYouUrl(tenantSlug, true);
    case 'institutional':
    case 'page':
      if (entitySlug) {
        const url = getPublicPageUrl(tenantSlug, entitySlug, true);
        if (url) return url;
      }
      return getPublicHomeUrl(tenantSlug, true);
    case 'landing_page':
    case 'landing':
      if (entitySlug) {
        const url = getPublicLandingUrl(tenantSlug, entitySlug, true);
        if (url) return url;
      }
      return getPublicHomeUrl(tenantSlug, true);
    case 'account':
      return getPublicAccountUrl(tenantSlug, true);
    case 'account_orders':
      return getPublicAccountOrdersUrl(tenantSlug, true);
    case 'account_order_detail':
      return getPublicAccountOrderDetailUrl(tenantSlug, undefined, true);
    default:
      return getPublicHomeUrl(tenantSlug, true);
  }
}

/**
 * Get preview URL with detailed result including validation status
 */
export function getPreviewUrlWithValidation(
  tenantSlug: string,
  pageType: string,
  entitySlug?: string
): PreviewUrlResult {
  switch (pageType) {
    case 'home':
      return { url: getPublicHomeUrl(tenantSlug, true), canPreview: true };
    case 'product':
      if (!entitySlug) {
        return { url: null, canPreview: false, reason: 'Selecione um produto para visualizar' };
      }
      const productUrl = getPublicProductUrl(tenantSlug, entitySlug, true);
      return productUrl 
        ? { url: productUrl, canPreview: true }
        : { url: null, canPreview: false, reason: 'Slug de produto inválido' };
    case 'category':
      if (!entitySlug) {
        return { url: null, canPreview: false, reason: 'Selecione uma categoria para visualizar' };
      }
      const categoryUrl = getPublicCategoryUrl(tenantSlug, entitySlug, true);
      return categoryUrl 
        ? { url: categoryUrl, canPreview: true }
        : { url: null, canPreview: false, reason: 'Slug de categoria inválido' };
    case 'cart':
      return { url: getPublicCartUrl(tenantSlug, true), canPreview: true };
    case 'checkout':
      return { url: getPublicCheckoutUrl(tenantSlug, true), canPreview: true };
    case 'thank_you':
    case 'obrigado':
      return { url: getPublicThankYouUrl(tenantSlug, true), canPreview: true };
    case 'institutional':
    case 'page':
      if (!entitySlug) {
        return { url: null, canPreview: false, reason: 'Slug de página não definido' };
      }
      const pageUrl = getPublicPageUrl(tenantSlug, entitySlug, true);
      return pageUrl 
        ? { url: pageUrl, canPreview: true }
        : { url: null, canPreview: false, reason: 'Slug de página inválido' };
    case 'landing_page':
    case 'landing':
      if (!entitySlug) {
        return { url: null, canPreview: false, reason: 'Slug de landing page não definido' };
      }
      const landingUrl = getPublicLandingUrl(tenantSlug, entitySlug, true);
      return landingUrl 
        ? { url: landingUrl, canPreview: true }
        : { url: null, canPreview: false, reason: 'Slug de landing page inválido' };
    case 'account':
      return { url: getPublicAccountUrl(tenantSlug, true), canPreview: true };
    case 'account_orders':
      return { url: getPublicAccountOrdersUrl(tenantSlug, true), canPreview: true };
    case 'account_order_detail':
      return { url: getPublicAccountOrderDetailUrl(tenantSlug, undefined, true), canPreview: true };
    default:
      return { url: getPublicHomeUrl(tenantSlug, true), canPreview: true };
  }
}

/**
 * Get the published (non-preview) URL for a specific entity
 */
export function getPublishedUrlForEntity(
  tenantSlug: string,
  entityType: string,
  entitySlug?: string
): string | null {
  switch (entityType) {
    case 'home':
      return getPublicHomeUrl(tenantSlug, false);
    case 'product':
      return getPublicProductUrl(tenantSlug, entitySlug, false);
    case 'category':
      return getPublicCategoryUrl(tenantSlug, entitySlug, false);
    case 'cart':
      return getPublicCartUrl(tenantSlug, false);
    case 'checkout':
      return getPublicCheckoutUrl(tenantSlug, false);
    case 'thank_you':
    case 'obrigado':
      return getPublicThankYouUrl(tenantSlug, false);
    case 'institutional':
    case 'page':
      return getPublicPageUrl(tenantSlug, entitySlug, false);
    case 'landing_page':
    case 'landing':
      return getPublicLandingUrl(tenantSlug, entitySlug, false);
    case 'account':
      return getPublicAccountUrl(tenantSlug, false);
    case 'account_orders':
      return getPublicAccountOrdersUrl(tenantSlug, false);
    case 'account_order_detail':
      return getPublicAccountOrderDetailUrl(tenantSlug, entitySlug, false);
    default:
      return getPublicHomeUrl(tenantSlug, false);
  }
}

/**
 * Diagnostic info for URL debugging
 */
export interface UrlDiagnostic {
  entityType: string;
  entityName: string;
  entitySlug?: string;
  publicUrl: string | null;
  previewUrl: string | null;
  status: 'valid' | 'invalid_slug' | 'missing_slug';
  message?: string;
}

/**
 * Generate diagnostic info for an entity
 */
export function diagnoseEntityUrl(
  tenantSlug: string,
  entityType: string,
  entityName: string,
  entitySlug?: string
): UrlDiagnostic {
  const publicUrl = getPublishedUrlForEntity(tenantSlug, entityType, entitySlug);
  const previewResult = getPreviewUrlWithValidation(tenantSlug, entityType, entitySlug);

  let status: UrlDiagnostic['status'] = 'valid';
  let message: string | undefined;

  if (!entitySlug && ['product', 'category', 'page', 'landing'].includes(entityType)) {
    status = 'missing_slug';
    message = 'Slug não definido';
  } else if (!publicUrl && entitySlug) {
    status = 'invalid_slug';
    message = 'Slug inválido';
  }

  return {
    entityType,
    entityName,
    entitySlug,
    publicUrl,
    previewUrl: previewResult.url,
    status,
    message,
  };
}

// =============================================
// CANONICAL URL BUILDERS (Absolute URLs with domain)
// These return full URLs suitable for sharing, copying, SEO, etc.
// =============================================

/**
 * Get the canonical home URL (absolute)
 */
export function getCanonicalHomeUrl(tenantSlug: string, customDomain: string | null | undefined): string {
  return getCanonicalStoreBaseUrl(tenantSlug, customDomain);
}

/**
 * Get the canonical product URL (absolute)
 */
export function getCanonicalProductUrl(
  tenantSlug: string, 
  productSlug: string | undefined, 
  customDomain: string | null | undefined
): string | null {
  if (!hasValidSlug(productSlug)) return null;
  const base = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  return `${base}/p/${productSlug}`;
}

/**
 * Get the canonical category URL (absolute)
 */
export function getCanonicalCategoryUrl(
  tenantSlug: string, 
  categorySlug: string | undefined, 
  customDomain: string | null | undefined
): string | null {
  if (!hasValidSlug(categorySlug)) return null;
  const base = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  return `${base}/c/${categorySlug}`;
}

/**
 * Get the canonical page URL (absolute)
 */
export function getCanonicalPageUrl(
  tenantSlug: string, 
  pageSlug: string | undefined, 
  customDomain: string | null | undefined
): string | null {
  if (!hasValidSlug(pageSlug)) return null;
  const base = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  return `${base}/page/${pageSlug}`;
}

/**
 * Get the canonical cart URL (absolute)
 */
export function getCanonicalCartUrl(tenantSlug: string, customDomain: string | null | undefined): string {
  const base = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  return `${base}/cart`;
}

/**
 * Get the canonical checkout URL (absolute)
 */
export function getCanonicalCheckoutUrl(tenantSlug: string, customDomain: string | null | undefined): string {
  const base = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  return `${base}/checkout`;
}

/**
 * Get the canonical thank-you URL (absolute)
 */
export function getCanonicalThankYouUrl(tenantSlug: string, customDomain: string | null | undefined): string {
  const base = getCanonicalStoreBaseUrl(tenantSlug, customDomain);
  return `${base}/obrigado`;
}
