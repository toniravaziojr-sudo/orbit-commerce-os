
-- Set SKU 0042 meta_retailer_id and create tombstone
UPDATE public.products
SET meta_retailer_id = '0042__meta_v2'
WHERE sku = '0042';

INSERT INTO public.meta_retired_ids (tenant_id, product_id, retired_id, channel, reason)
SELECT tenant_id, id, '0042', 'meta', 'ID envenenado no Commerce Manager - recriado como 0042__meta_v2'
FROM public.products
WHERE sku = '0042'
ON CONFLICT (tenant_id, retired_id, channel) DO NOTHING;
