-- Reset checkout header/footer configs to proper checkout-optimized defaults
-- This fixes configs that were incorrectly initialized with global header/footer values

-- Update checkout_header_config to use checkout-optimized defaults
-- Only update where showSearch is true (indicating incorrect initialization)
UPDATE storefront_global_layout
SET checkout_header_config = jsonb_build_object(
  'id', 'checkout-header',
  'type', 'Header',
  'props', jsonb_build_object(
    'menuId', '',
    'showSearch', false,
    'showCart', true,
    'sticky', true,
    'showHeaderMenu', false,
    'customerAreaEnabled', false,
    'featuredPromosEnabled', false,
    'noticeEnabled', false
  )
)
WHERE checkout_header_config IS NOT NULL 
  AND (
    checkout_header_config->'props'->>'showSearch' = 'true'
    OR checkout_header_config->'props'->>'showHeaderMenu' IS NULL
    OR checkout_header_config->'props'->>'showHeaderMenu' = 'true'
  );

-- Update checkout_footer_config to use checkout-optimized defaults
-- Only update where showSocial is true (indicating incorrect initialization)
UPDATE storefront_global_layout
SET checkout_footer_config = jsonb_build_object(
  'id', 'checkout-footer',
  'type', 'Footer',
  'props', jsonb_build_object(
    'menuId', '',
    'showSocial', false,
    'showNewsletterSection', false,
    'copyrightText', '© 2024 Sua Loja. Todos os direitos reservados.'
  )
)
WHERE checkout_footer_config IS NOT NULL 
  AND (
    checkout_footer_config->'props'->>'showSocial' = 'true'
    OR checkout_footer_config->'props'->>'showNewsletterSection' IS NULL
    OR checkout_footer_config->'props'->>'showNewsletterSection' = 'true'
  );