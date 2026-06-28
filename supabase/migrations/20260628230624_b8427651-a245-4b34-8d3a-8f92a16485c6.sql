CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_marketplace_order_unique
ON public.orders (tenant_id, marketplace_order_id)
WHERE marketplace_order_id IS NOT NULL;