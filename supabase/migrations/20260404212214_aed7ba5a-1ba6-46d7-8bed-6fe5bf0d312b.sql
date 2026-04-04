-- Drop unique constraints first (they back the indexes)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_tenant_id_sku_key;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_tenant_id_slug_key;

-- Drop remaining indexes
DROP INDEX IF EXISTS idx_products_slug_lower;
DROP INDEX IF EXISTS idx_products_sku;

-- Recreate as partial unique indexes (only enforced for active products)
CREATE UNIQUE INDEX products_tenant_id_sku_key 
  ON public.products (tenant_id, sku) 
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX products_tenant_id_slug_key 
  ON public.products (tenant_id, slug) 
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_products_slug_lower 
  ON public.products (tenant_id, lower(slug)) 
  WHERE deleted_at IS NULL;

-- Keep the non-unique performance index for SKU lookups (includes archived)
CREATE INDEX idx_products_sku 
  ON public.products (tenant_id, sku);