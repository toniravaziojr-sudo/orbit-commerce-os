-- Backfill tenant_id on product_images from parent product
UPDATE public.product_images pi
SET tenant_id = p.tenant_id
FROM public.products p
WHERE pi.product_id = p.id
  AND pi.tenant_id IS NULL;