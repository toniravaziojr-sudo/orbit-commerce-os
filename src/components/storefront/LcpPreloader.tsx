// =============================================
// LCP PRELOADER - Preloads hero banner image for faster LCP
// Fetches the first banner slide URL and injects <link rel="preload">
// =============================================

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getHeroBannerImageUrl } from '@/lib/imageTransform';

interface LcpPreloaderProps {
  tenantId: string;
}

/**
 * Preloads the first hero banner image via <link rel="preload">.
 * This eliminates the "resource load delay" for the LCP element
 * by starting the download before the JS bundle renders the banner.
 */
export function LcpPreloader({ tenantId }: LcpPreloaderProps) {
  // Fetch only the first banner slide URL from the published template
  const { data: bannerData } = useQuery({
    queryKey: ['lcp-preload', tenantId],
    queryFn: async () => {
      // Get the published template set
      const { data: settings } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!settings?.published_template_id) return null;

      const { data: templateSet } = await supabase
        .from('storefront_template_sets')
        .select('published_content')
        .eq('id', settings.published_template_id)
        .maybeSingle();

      if (!templateSet?.published_content) return null;

      // Extract the first HeroBanner slide from the home page content
      const content = templateSet.published_content as any;
      const homeContent = content?.home;
      if (!homeContent?.children) return null;

      // Find the first HeroBanner block
      const findHeroBanner = (nodes: any[]): any => {
        for (const node of nodes) {
          if (node.type === 'HeroBanner' && node.props?.slides?.length > 0) {
            return node.props.slides[0];
          }
          if (node.children) {
            const found = findHeroBanner(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const firstSlide = findHeroBanner(homeContent.children);
      if (!firstSlide) return null;

      return {
        desktopUrl: firstSlide.imageDesktop || null,
        mobileUrl: firstSlide.imageMobile || firstSlide.imageDesktop || null,
      };
    },
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });

  // Inject preload links
  useEffect(() => {
    if (!bannerData?.desktopUrl) return;

    const links: HTMLLinkElement[] = [];

    // Desktop preload
    const desktopUrl = getHeroBannerImageUrl(bannerData.desktopUrl, 'desktop');
    if (desktopUrl && desktopUrl !== '/placeholder.svg') {
      const desktopLink = document.createElement('link');
      desktopLink.rel = 'preload';
      desktopLink.as = 'image';
      desktopLink.href = desktopUrl;
      desktopLink.media = '(min-width: 768px)';
      document.head.appendChild(desktopLink);
      links.push(desktopLink);
    }

    // Mobile preload
    const mobileRaw = bannerData.mobileUrl || bannerData.desktopUrl;
    const mobileUrl = getHeroBannerImageUrl(mobileRaw, 'mobile');
    if (mobileUrl && mobileUrl !== '/placeholder.svg') {
      const mobileLink = document.createElement('link');
      mobileLink.rel = 'preload';
      mobileLink.as = 'image';
      mobileLink.href = mobileUrl;
      mobileLink.media = '(max-width: 767px)';
      document.head.appendChild(mobileLink);
      links.push(mobileLink);
    }

    return () => {
      links.forEach(el => el.remove());
    };
  }, [bannerData]);

  return null;
}
