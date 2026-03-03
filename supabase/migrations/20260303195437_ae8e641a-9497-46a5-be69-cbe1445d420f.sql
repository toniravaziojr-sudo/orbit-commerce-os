
-- Add free_shipping column to products table
ALTER TABLE public.products
ADD COLUMN free_shipping boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.products.free_shipping IS 'If true, product always has free shipping regardless of other rules (highest priority)';
