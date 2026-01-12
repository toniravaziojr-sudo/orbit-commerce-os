-- Backfill tenant_id in product_images from products
UPDATE public.product_images pi
SET tenant_id = p.tenant_id
FROM public.products p
WHERE pi.product_id = p.id
  AND pi.tenant_id IS NULL;

-- Backfill tenant_id in order_items from orders
UPDATE public.order_items oi
SET tenant_id = o.tenant_id
FROM public.orders o
WHERE oi.order_id = o.id
  AND oi.tenant_id IS NULL;

-- Add indexes for tenant_id on child tables if not exist
CREATE INDEX IF NOT EXISTS idx_product_images_tenant_id ON public.product_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON public.order_items(tenant_id);

-- Add comment
COMMENT ON COLUMN public.product_images.tenant_id IS 'Tenant ID backfilled from products for multi-tenant isolation';
COMMENT ON COLUMN public.order_items.tenant_id IS 'Tenant ID backfilled from orders for multi-tenant isolation';