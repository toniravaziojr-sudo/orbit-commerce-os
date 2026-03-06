// =============================================
// STOREFRONT HEAD - Dynamic head management for tenant storefronts
// Updates favicon, title, meta tags based on store_settings from bootstrap
// OPTIMIZED: No separate queries — receives data via props from bootstrap
// =============================================

import { useEffect } from 'react';

interface StorefrontHeadProps {
  tenantId: string;
  pageTitle?: string;
  pageDescription?: string;
  /** Store settings from bootstrap — avoids separate query */
  storeSettings?: {
    favicon_url?: string | null;
    favicon_files?: Record<string, string> | null;
    store_name?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
  } | null;
}

export function StorefrontHead({ tenantId, pageTitle, pageDescription, storeSettings }: StorefrontHeadProps) {
  // Apply favicon (simple or multi-size)
  useEffect(() => {
    const faviconFiles = storeSettings?.favicon_files as Record<string, string> | null;
    const defaultFavicon = storeSettings?.favicon_url;
    
    // Se não tem favicon configurado, não faz nada (mantém default do index.html)
    if (!faviconFiles && !defaultFavicon) return;

    // SEMPRE remover TODOS os favicons existentes antes de aplicar os novos
    const existingFavicons = document.querySelectorAll(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );
    existingFavicons.forEach(el => el.remove());

    const createdElements: HTMLLinkElement[] = [];

    // Multi-size favicon support
    if (faviconFiles && Object.keys(faviconFiles).length > 0) {
      const sizeMap: Record<string, { sizes: string; rel: string }> = {
        '16': { sizes: '16x16', rel: 'icon' },
        '32': { sizes: '32x32', rel: 'icon' },
        '48': { sizes: '48x48', rel: 'icon' },
        '180': { sizes: '180x180', rel: 'apple-touch-icon' },
      };
      
      Object.entries(faviconFiles).forEach(([size, url]) => {
        if (!url) return;
        const config = sizeMap[size];
        if (config) {
          const link = document.createElement('link');
          link.rel = config.rel;
          link.type = 'image/png';
          link.sizes = config.sizes;
          link.href = url;
          document.head.appendChild(link);
          createdElements.push(link);
        }
      });
      
      // Fallback shortcut icon
      const fallbackUrl = faviconFiles['32'] || faviconFiles['16'] || defaultFavicon;
      if (fallbackUrl) {
        const fallbackLink = document.createElement('link');
        fallbackLink.rel = 'shortcut icon';
        fallbackLink.href = fallbackUrl;
        document.head.appendChild(fallbackLink);
        createdElements.push(fallbackLink);
      }
    } else if (defaultFavicon) {
      const faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      faviconLink.type = 'image/png';
      faviconLink.href = defaultFavicon;
      document.head.appendChild(faviconLink);
      createdElements.push(faviconLink);
      
      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.href = defaultFavicon;
      document.head.appendChild(shortcutLink);
      createdElements.push(shortcutLink);
    }

    // NO cleanup on unmount — favicon should persist across navigations
    // The cleanup was causing the "flickering" between tenant favicon and platform favicon
  }, [storeSettings?.favicon_url, storeSettings?.favicon_files]);

  // Apply document title
  useEffect(() => {
    const storeName = storeSettings?.store_name || '';
    const seoTitle = storeSettings?.seo_title;
    
    let title = pageTitle || seoTitle || storeName || 'Loja';
    
    if (pageTitle && storeName && pageTitle !== storeName) {
      title = `${pageTitle} | ${storeName}`;
    }

    document.title = title;
  }, [pageTitle, storeSettings?.store_name, storeSettings?.seo_title]);

  // Apply meta description
  useEffect(() => {
    const description = pageDescription || storeSettings?.seo_description;
    if (!description) return;

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }

    metaDesc.content = description;
  }, [pageDescription, storeSettings?.seo_description]);

  return null;
}
