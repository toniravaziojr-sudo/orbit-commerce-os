
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_attempt_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_attempt_id 
  ON public.orders (tenant_id, checkout_attempt_id) 
  WHERE checkout_attempt_id IS NOT NULL;

COMMENT ON COLUMN public.orders.checkout_attempt_id IS 'UUID generated per checkout click to prevent duplicate order creation (idempotency key)';
