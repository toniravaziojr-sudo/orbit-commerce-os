// =============================================
// CART PROMO BANNER - Promotional banner for cart page
// Responsive with individual control for desktop/mobile
// Respects bannerDisplay setting (cart_page, mini_cart, both)
// =============================================

import { useState, useEffect } from 'react';
import { CartConfig } from '@/lib/storeConfigTypes';

interface CartPromoBannerProps {
  config: CartConfig;
  /** Where the banner is being rendered */
  location?: 'cart_page' | 'mini_cart';
}

export function CartPromoBanner({ config, location = 'cart_page' }: CartPromoBannerProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if banner should be shown based on display location setting
  const bannerDisplay = config.bannerDisplay || 'cart_page';
  const shouldShowAtLocation = 
    bannerDisplay === 'both' || 
    bannerDisplay === location;

  if (!shouldShowAtLocation) {
    return null;
  }

  // Check if banner should be shown for current viewport
  const shouldShowDesktop = !isMobile && config.bannerDesktopEnabled && config.bannerDesktopUrl;
  const shouldShowMobile = isMobile && config.bannerMobileEnabled && config.bannerMobileUrl;

  if (!shouldShowDesktop && !shouldShowMobile) {
    return null;
  }

  const imageUrl = isMobile ? config.bannerMobileUrl : config.bannerDesktopUrl;
  const hasLink = !!config.bannerLink;

  const bannerContent = (
    <img
      src={imageUrl!}
      alt="Promoção"
      className="w-full h-auto object-cover rounded-lg"
      loading="lazy"
    />
  );

  return (
    <div className={location === 'mini_cart' ? 'mb-4' : 'mb-6'}>
      {hasLink ? (
        <a 
          href={config.bannerLink!}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:opacity-90 transition-opacity"
        >
          {bannerContent}
        </a>
      ) : (
        bannerContent
      )}
    </div>
  );
}
