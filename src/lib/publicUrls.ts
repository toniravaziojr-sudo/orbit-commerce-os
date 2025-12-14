// =============================================
// PUBLIC URLS - Central URL builder for all public storefront routes
// Single source of truth for all public URL generation
// =============================================

/**
 * Get the base URL for a store
 */
export function getStoreBaseUrl(tenantSlug: string): string {
  return `/store/${tenantSlug}`;
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
 * @param productSlug - The product slug/handle (required - if empty, returns null)
 */
export function getPublicProductUrl(tenantSlug: string, productSlug: string | undefined, preview = false): string | null {
  if (!productSlug) return null;
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/p/${productSlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public category URL
 * @param tenantSlug - The tenant slug
 * @param categorySlug - The category slug (required - if empty, returns null)
 */
export function getPublicCategoryUrl(tenantSlug: string, categorySlug: string | undefined, preview = false): string | null {
  if (!categorySlug) return null;
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
 * Get the public institutional page URL
 * @param tenantSlug - The tenant slug
 * @param pageSlug - The page slug (required - if empty, returns null)
 */
export function getPublicPageUrl(tenantSlug: string, pageSlug: string | undefined, preview = false): string | null {
  if (!pageSlug) return null;
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/page/${pageSlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public landing page URL
 * @param tenantSlug - The tenant slug
 * @param landingSlug - The landing page slug (required - if empty, returns null)
 */
export function getPublicLandingUrl(tenantSlug: string, landingSlug: string | undefined, preview = false): string | null {
  if (!landingSlug) return null;
  const base = getStoreBaseUrl(tenantSlug);
  const url = `${base}/lp/${landingSlug}`;
  return preview ? `${url}?preview=1` : url;
}

/**
 * Get the public "My Orders" URL
 */
export function getPublicMyOrdersUrl(tenantSlug: string): string {
  return `${getStoreBaseUrl(tenantSlug)}/minhas-compras`;
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
      return getPublicCategoryUrl(tenantSlug, category.slug) || baseUrl;
    }
  }

  // Page reference (institutional or landing)
  if (item.item_type === 'page' && item.ref_id && pages) {
    const page = pages.find(p => p.id === item.ref_id);
    if (page) {
      // Check if it's a landing page
      if (page.type === 'landing_page') {
        return getPublicLandingUrl(tenantSlug, page.slug) || baseUrl;
      }
      // Default to institutional page
      return getPublicPageUrl(tenantSlug, page.slug) || baseUrl;
    }
  }

  // Fallback to provided URL or base
  return item.url || baseUrl;
}

/**
 * Get preview URL for editor context
 * @param tenantSlug - The tenant slug
 * @param pageType - The page type being edited
 * @param entitySlug - Optional slug of the specific entity (product/category/page)
 */
export function getPreviewUrlForEditor(
  tenantSlug: string,
  pageType: string,
  entitySlug?: string
): string {
  switch (pageType) {
    case 'home':
      return getPublicHomeUrl(tenantSlug, true);
    case 'product':
      // If we have a specific product slug, use it
      if (entitySlug) {
        return getPublicProductUrl(tenantSlug, entitySlug, true) || getPublicHomeUrl(tenantSlug, true);
      }
      // Fallback: need a product selected
      return getPublicHomeUrl(tenantSlug, true);
    case 'category':
      // If we have a specific category slug, use it
      if (entitySlug) {
        return getPublicCategoryUrl(tenantSlug, entitySlug, true) || getPublicHomeUrl(tenantSlug, true);
      }
      // Fallback: need a category selected
      return getPublicHomeUrl(tenantSlug, true);
    case 'cart':
      return getPublicCartUrl(tenantSlug, true);
    case 'checkout':
      return getPublicCheckoutUrl(tenantSlug, true);
    case 'institutional':
    case 'page':
      if (entitySlug) {
        return getPublicPageUrl(tenantSlug, entitySlug, true) || getPublicHomeUrl(tenantSlug, true);
      }
      return getPublicHomeUrl(tenantSlug, true);
    case 'landing_page':
    case 'landing':
      if (entitySlug) {
        return getPublicLandingUrl(tenantSlug, entitySlug, true) || getPublicHomeUrl(tenantSlug, true);
      }
      return getPublicHomeUrl(tenantSlug, true);
    default:
      return getPublicHomeUrl(tenantSlug, true);
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
    case 'institutional':
    case 'page':
      return getPublicPageUrl(tenantSlug, entitySlug, false);
    case 'landing_page':
    case 'landing':
      return getPublicLandingUrl(tenantSlug, entitySlug, false);
    default:
      return getPublicHomeUrl(tenantSlug, false);
  }
}
