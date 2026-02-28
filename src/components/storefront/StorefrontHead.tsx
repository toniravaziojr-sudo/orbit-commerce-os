// =============================================
// STOREFRONT HEAD - Dynamic head management for tenant storefronts
// Updates favicon, title, meta tags, and theme colors based on tenant store_settings
// =============================================

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StorefrontHeadProps {
  tenantId: string;
  pageTitle?: string;
  pageDescription?: string;
}

// Helper to convert hex color to HSL string for CSS variables
function hexToHslValues(hex: string): string | null {
  if (!hex || !hex.startsWith('#')) return null;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Return in format "H S% L%" for CSS variable
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Calculate contrasting foreground color (light or dark)
function getContrastingForeground(hex: string): string {
  if (!hex || !hex.startsWith('#')) return '0 0% 100%'; // default white
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 100%';
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark for light backgrounds
  return luminance > 0.5 ? '0 0% 0%' : '0 0% 100%';
}

export function StorefrontHead({ tenantId, pageTitle, pageDescription }: StorefrontHeadProps) {
  // Fetch store settings to get favicon, SEO, and theme colors
  const { data: storeSettings } = useQuery({
    queryKey: ['storefront-head-settings', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('favicon_url, favicon_files, store_name, seo_title, seo_description, primary_color, secondary_color, accent_color')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      // Cast to unknown first to handle types not yet regenerated
      return data as unknown as {
        favicon_url: string | null;
        favicon_files: Record<string, string> | null;
        store_name: string | null;
        seo_title: string | null;
        seo_description: string | null;
        primary_color: string | null;
        secondary_color: string | null;
        accent_color: string | null;
      } | null;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Apply favicon (simple or multi-size)
  useEffect(() => {
    const faviconFiles = storeSettings?.favicon_files as Record<string, string> | null;
    const defaultFavicon = storeSettings?.favicon_url;
    
    // Se não tem favicon configurado, não faz nada (mantém default do index.html)
    if (!faviconFiles && !defaultFavicon) return;

    // SEMPRE remover TODOS os favicons existentes antes de aplicar os novos
    // Isso é crítico porque o index.html tem múltiplos links de favicon
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
      // Single favicon - criar todos os tamanhos apontando para a mesma URL
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

    // Cleanup on unmount
    return () => {
      createdElements.forEach(el => el.remove());
      // Restore default favicon
      let defaultLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!defaultLink) {
        defaultLink = document.createElement('link');
        defaultLink.rel = 'icon';
        document.head.appendChild(defaultLink);
      }
      defaultLink.href = '/favicon.png';
    };
  }, [storeSettings?.favicon_url, storeSettings?.favicon_files]);

  // Apply document title
  useEffect(() => {
    const storeName = storeSettings?.store_name || '';
    const seoTitle = storeSettings?.seo_title;
    
    let title = pageTitle || seoTitle || storeName || 'Loja';
    
    // If page title is provided and different from store name, combine them
    if (pageTitle && storeName && pageTitle !== storeName) {
      title = `${pageTitle} | ${storeName}`;
    }

    document.title = title;

    return () => {
      document.title = 'Loja';
    };
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

  // NOTE: LCP preloading is handled by LcpPreloader component

  // This component doesn't render anything visible
  return null;
}
