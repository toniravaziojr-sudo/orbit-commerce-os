ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number_int bigint
  GENERATED ALWAYS AS (
    NULLIF(regexp_replace(COALESCE(order_number, ''), '\D', '', 'g'), '')::bigint
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_order_number_int_desc
  ON public.orders (tenant_id, order_number_int DESC NULLS LAST, created_at DESC);