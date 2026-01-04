-- Add cart_config and checkout_config JSONB columns to store_settings
ALTER TABLE store_settings 
  ADD COLUMN IF NOT EXISTS cart_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checkout_config JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN store_settings.cart_config IS 'Cart display and feature configuration: miniCartEnabled, showGoToCartButton, crossSellEnabled, shippingCalculatorEnabled, couponEnabled, sessionTrackingEnabled, bannerDesktopEnabled, bannerDesktopUrl, bannerMobileEnabled, bannerMobileUrl, bannerLink';
COMMENT ON COLUMN store_settings.checkout_config IS 'Checkout display and feature configuration: couponEnabled, orderBumpEnabled, testimonialsEnabled, paymentMethodsOrder, purchaseEventTiming';