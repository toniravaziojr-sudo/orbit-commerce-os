-- Add discount columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS discount_code TEXT NULL,
ADD COLUMN IF NOT EXISTS discount_name TEXT NULL,
ADD COLUMN IF NOT EXISTS discount_type TEXT NULL,
ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN NOT NULL DEFAULT false;

-- Add index for analytics
CREATE INDEX IF NOT EXISTS idx_orders_discount_code ON public.orders(discount_code) WHERE discount_code IS NOT NULL;

COMMENT ON COLUMN public.orders.discount_code IS 'Applied coupon code';
COMMENT ON COLUMN public.orders.discount_name IS 'Name of the discount';
COMMENT ON COLUMN public.orders.discount_type IS 'Type: order_percent, order_fixed, free_shipping';
COMMENT ON COLUMN public.orders.free_shipping IS 'Whether free shipping was granted by coupon';