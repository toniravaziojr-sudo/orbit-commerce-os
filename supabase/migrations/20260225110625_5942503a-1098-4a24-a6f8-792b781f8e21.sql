-- Drop unique constraint to allow multiple listings per product
DROP INDEX IF EXISTS public.idx_meli_listings_tenant_product;

-- Create a non-unique index instead for performance
CREATE INDEX IF NOT EXISTS idx_meli_listings_tenant_product_nonunique ON public.meli_listings(tenant_id, product_id);