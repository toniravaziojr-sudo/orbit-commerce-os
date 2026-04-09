UPDATE store_settings 
SET checkout_config = jsonb_set(
  checkout_config::jsonb, 
  '{purchaseEventTiming}', 
  '"all_orders"'
)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';