// =============================================
// CART PROMO BANNER - Promotional banner for cart page
// Responsive with individual control for desktop/mobile
// Uses container queries for Builder compatibility
// Respects bannerDisplay setting (cart_page, mini_cart, both)
// =============================================

import { CartConfig } from '@/lib/storeConfigTypes';

interface CartPromoBannerProps {
  config: CartConfig;
  /** Where the banner is being rendered */
  location?: 'cart_page' | 'mini_cart';
}

export function CartPromoBanner({ config, location = 'cart_page' }: CartPromoBannerProps) {
  // Check if banner should be shown based on display location setting
  const bannerDisplay = config.bannerDisplay || 'cart_page';
  const shouldShowAtLocation = 
    bannerDisplay === 'both' || 
    bannerDisplay === location;

  if (!shouldShowAtLocation) {
    return null;
  }

  // Check if any banner is enabled
  const hasDesktopBanner = config.bannerDesktopEnabled && config.bannerDesktopUrl;
  const hasMobileBanner = config.bannerMobileEnabled && config.bannerMobileUrl;

  if (!hasDesktopBanner && !hasMobileBanner) {
    return null;
  }

  const hasLink = !!config.bannerLink;
  const hasBoth = hasDesktopBanner && hasMobileBanner;

  const renderBanners = () => {
    // If both are configured, show responsive banners
    if (hasBoth) {
      return (
        <>
          {/* Mobile banner - visible only on mobile (container query) */}
          <img
            src={config.bannerMobileUrl!}
            alt="Promoção"
            className="w-full h-auto object-cover rounded-lg sf-show-mobile sf-hide-desktop"
            loading="lazy"
            decoding="async"
          />
          {/* Desktop banner - visible only on desktop (container query) */}
          <img
            src={config.bannerDesktopUrl!}
            alt="Promoção"
            loading="lazy"
            decoding="async"
            className="w-full h-auto object-cover rounded-lg sf-hide-mobile sf-show-desktop"
          />
        </>
      );
    }
    
    // If only one is configured, show it for all viewports
    const imageUrl = hasDesktopBanner ? config.bannerDesktopUrl : config.bannerMobileUrl;
    return (
      <img
        src={imageUrl!}
        alt="Promoção"
        className="w-full h-auto object-cover rounded-lg"
        loading="lazy"
      />
    );
  };

  return (
    <div className={location === 'mini_cart' ? 'mb-4' : 'mb-6'}>
      {hasLink ? (
        <a 
          href={config.bannerLink!}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:opacity-90 transition-opacity"
        >
          {renderBanners()}
        </a>
      ) : (
        renderBanners()
      )}
    </div>
  );
}
