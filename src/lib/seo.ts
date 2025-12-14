// =============================================
// SEO UTILITY FUNCTIONS
// =============================================

export interface PageSeoData {
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImageUrl?: string | null;
  noIndex?: boolean | null;
  canonicalUrl?: string | null;
  title?: string;
  name?: string;
  type?: string | null;
}

export interface StoreDefaults {
  storeName?: string | null;
  storeDescription?: string | null;
  defaultOgImage?: string | null;
  logoUrl?: string | null;
}

export interface EffectiveSeo {
  title: string;
  description: string;
  image: string;
  robots: string;
  canonical: string;
  ogType: string;
}

/**
 * Resolve effective SEO metadata with fallback to store defaults
 */
export function getEffectiveSeo(
  page: PageSeoData | null | undefined,
  storeDefaults: StoreDefaults,
  currentUrl: string
): EffectiveSeo {
  const pageName = page?.title || page?.name || 'Página';
  const storeName = storeDefaults.storeName || 'Loja';
  const isCheckout = page?.type === 'checkout';

  // Title: page meta_title > page name + store name
  const title = page?.metaTitle || `${pageName} | ${storeName}`;

  // Description: page meta_description > store description > empty
  const description = page?.metaDescription || storeDefaults.storeDescription || '';

  // Image: page og image > store logo > empty
  const image = page?.metaImageUrl || storeDefaults.defaultOgImage || storeDefaults.logoUrl || '';

  // Robots: checkout always noindex, else check page noIndex flag
  let robots = 'index,follow';
  if (isCheckout) {
    robots = 'noindex,nofollow';
  } else if (page?.noIndex) {
    robots = 'noindex,follow';
  }

  // Canonical: page canonical > current URL
  const canonical = page?.canonicalUrl || currentUrl;

  return {
    title,
    description,
    image,
    robots,
    canonical,
    ogType: 'website',
  };
}

/**
 * Apply SEO meta tags to the document head
 */
export function applySeoToDocument(seo: EffectiveSeo): void {
  // Title
  document.title = seo.title;

  // Helper to set/update meta tag
  const setMeta = (name: string, content: string, property = false) => {
    if (!content) return;
    const attr = property ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  // Basic meta
  setMeta('description', seo.description);
  setMeta('robots', seo.robots);

  // Open Graph
  setMeta('og:title', seo.title, true);
  setMeta('og:description', seo.description, true);
  setMeta('og:image', seo.image, true);
  setMeta('og:url', seo.canonical, true);
  setMeta('og:type', seo.ogType, true);

  // Twitter
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', seo.title);
  setMeta('twitter:description', seo.description);
  setMeta('twitter:image', seo.image);

  // Canonical link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', seo.canonical);
}
