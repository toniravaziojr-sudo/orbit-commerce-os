-- Update existing checkout_footer_config to include all minimalist defaults
-- This ensures existing tenants get the proper checkout footer behavior

UPDATE storefront_global_layout
SET checkout_footer_config = jsonb_build_object(
  'id', 'checkout-footer',
  'type', 'Footer',
  'props', jsonb_build_object(
    'menuId', COALESCE(checkout_footer_config->'props'->>'menuId', ''),
    'showSocial', COALESCE((checkout_footer_config->'props'->>'showSocial')::boolean, false),
    'showNewsletterSection', COALESCE((checkout_footer_config->'props'->>'showNewsletterSection')::boolean, false),
    'showFooter1', COALESCE((checkout_footer_config->'props'->>'showFooter1')::boolean, false),
    'showFooter2', COALESCE((checkout_footer_config->'props'->>'showFooter2')::boolean, false),
    'showSac', COALESCE((checkout_footer_config->'props'->>'showSac')::boolean, false),
    'showLogo', COALESCE((checkout_footer_config->'props'->>'showLogo')::boolean, true),
    'showStoreInfo', COALESCE((checkout_footer_config->'props'->>'showStoreInfo')::boolean, false),
    'showCopyright', COALESCE((checkout_footer_config->'props'->>'showCopyright')::boolean, true),
    'copyrightText', COALESCE(checkout_footer_config->'props'->>'copyrightText', '© 2024 Sua Loja. Todos os direitos reservados.')
  )
)
WHERE checkout_footer_config IS NOT NULL;