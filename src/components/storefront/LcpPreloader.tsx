// =============================================
// LCP PRELOADER - Preloads hero banner image for faster LCP
// OPTIMIZED: Accepts bootstrapTemplate to skip separate queries
// =============================================

import { useEffect, useMemo } from 'react';
import { getHeroBannerImageUrl } from '@/lib/imageTransform';

interface LcpPreloaderProps {
  tenantId: string;
  /** Template from bootstrap — skips separate queries when provided */
  bootstrapTemplate?: any;
}

/**
 * Preloads the first hero banner image via <link rel="preload">.
 * This eliminates the "resource load delay" for the LCP element
 * by starting the download before the JS bundle renders the banner.
 */
export function LcpPreloader({ tenantId, bootstrapTemplate }: LcpPreloaderProps) {
  // Extract banner data from bootstrap template (no queries needed)
  const bannerData = useMemo(() => {
    if (!bootstrapTemplate?.published_content) return null;

    const content = bootstrapTemplate.published_content as any;
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
  }, [bootstrapTemplate]);

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