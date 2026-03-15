
-- Add retry_from_order_id to link retry orders to their original
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS retry_from_order_id UUID REFERENCES public.orders(id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_retry_from_order_id ON public.orders(retry_from_order_id) WHERE retry_from_order_id IS NOT NULL;
