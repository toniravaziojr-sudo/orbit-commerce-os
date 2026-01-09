-- Add source_order_number and source_platform columns to orders for imported orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS source_order_number TEXT,
ADD COLUMN IF NOT EXISTS source_platform TEXT;

-- Add index for faster lookups on source_order_number
CREATE INDEX IF NOT EXISTS idx_orders_source_order_number 
ON public.orders(tenant_id, source_order_number) 
WHERE source_order_number IS NOT NULL;

-- Add index on source_platform
CREATE INDEX IF NOT EXISTS idx_orders_source_platform 
ON public.orders(tenant_id, source_platform) 
WHERE source_platform IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN public.orders.source_order_number IS 'Original order number from the source platform (e.g., #3381 from Shopify)';
COMMENT ON COLUMN public.orders.source_platform IS 'Source platform from which the order was imported (e.g., shopify, woocommerce)';