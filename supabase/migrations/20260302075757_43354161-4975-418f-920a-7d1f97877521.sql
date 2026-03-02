-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Create accent-insensitive product search function
CREATE OR REPLACE FUNCTION public.search_products_fuzzy(
  p_tenant_id uuid,
  p_query text,
  p_limit integer DEFAULT 20,
  p_exclude_kits boolean DEFAULT true
)
RETURNS TABLE(
  id uuid,
  name text,
  sku text,
  price numeric,
  compare_at_price numeric,
  stock_quantity integer,
  status text,
  product_format text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT 
    p.id, p.name, p.sku, p.price, p.compare_at_price, 
    p.stock_quantity, p.status, p.product_format, p.created_at
  FROM public.products p
  WHERE p.tenant_id = p_tenant_id
    AND p.deleted_at IS NULL
    AND (
      extensions.unaccent(lower(p.name)) LIKE '%' || extensions.unaccent(lower(p_query)) || '%'
      OR p.sku ILIKE '%' || p_query || '%'
    )
    AND (NOT p_exclude_kits OR p.product_format IS DISTINCT FROM 'with_composition')
  ORDER BY p.name
  LIMIT p_limit;
$$;