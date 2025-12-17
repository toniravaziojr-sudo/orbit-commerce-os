-- Add configuration columns to store_settings table
-- These columns store typed JSON configurations for shipping, benefits, and offers

-- ShippingSettings: provider, originZip, rules for manual_table
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS shipping_config JSONB DEFAULT '{
  "provider": "mock",
  "originZip": "",
  "defaultPrice": 15,
  "defaultDays": 7,
  "freeShippingThreshold": null,
  "rules": []
}'::jsonb;

-- BenefitSettings: progress bar configuration
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS benefit_config JSONB DEFAULT '{
  "enabled": false,
  "mode": "free_shipping",
  "thresholdValue": 200,
  "rewardLabel": "Frete Grátis",
  "successLabel": "Você ganhou frete grátis!",
  "progressColor": "#22c55e"
}'::jsonb;

-- OffersConfig: cross-sell, bundles, order bump settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS offers_config JSONB DEFAULT '{
  "crossSell": {
    "enabled": false,
    "strategy": "manual",
    "productIds": [],
    "maxItems": 4,
    "title": "Complete seu pedido"
  },
  "bundles": {
    "enabled": false,
    "bundleProductIds": [],
    "title": "Kits com desconto",
    "showSavings": true
  },
  "orderBump": {
    "enabled": false,
    "productIds": [],
    "title": "Aproveite esta oferta!",
    "description": "Adicione ao seu pedido com desconto especial",
    "discountPercent": 10,
    "defaultChecked": false
  },
  "buyTogether": {
    "enabled": true,
    "useExistingRules": true
  }
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.store_settings.shipping_config IS 'Shipping provider configuration: mock, manual_table, or external';
COMMENT ON COLUMN public.store_settings.benefit_config IS 'Progress bar/benefit threshold configuration';
COMMENT ON COLUMN public.store_settings.offers_config IS 'Cross-sell, bundles, order bump, and buy together configuration';