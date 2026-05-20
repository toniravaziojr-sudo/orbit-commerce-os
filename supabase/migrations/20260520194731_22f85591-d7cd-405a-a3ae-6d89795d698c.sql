-- 1) Coluna product_id em fiscal_invoice_items
ALTER TABLE public.fiscal_invoice_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_invoice_items_product_id
  ON public.fiscal_invoice_items(product_id);

-- 2) Backfill: order_item_id -> order_items.product_id
UPDATE public.fiscal_invoice_items fii
SET product_id = oi.product_id
FROM public.order_items oi
WHERE fii.product_id IS NULL
  AND fii.order_item_id = oi.id
  AND oi.product_id IS NOT NULL;

-- 3) Backfill: SKU exato -> products.sku no tenant da NF
UPDATE public.fiscal_invoice_items fii
SET product_id = p.id
FROM public.fiscal_invoices fi, public.products p
WHERE fii.product_id IS NULL
  AND fii.invoice_id = fi.id
  AND p.tenant_id = fi.tenant_id
  AND p.sku IS NOT NULL
  AND p.sku <> ''
  AND lower(p.sku) = lower(trim(fii.codigo_produto));

-- 4) Backfill: prefixo de 8 hex -> products.id no tenant
WITH candidates AS (
  SELECT fii.id AS item_id,
         lower(trim(fii.codigo_produto)) AS prefix,
         fi.tenant_id
  FROM public.fiscal_invoice_items fii
  JOIN public.fiscal_invoices fi ON fi.id = fii.invoice_id
  WHERE fii.product_id IS NULL
    AND trim(fii.codigo_produto) ~* '^[0-9a-f]{8}$'
),
matches AS (
  SELECT DISTINCT ON (c.item_id)
         c.item_id,
         p.id AS product_id
  FROM candidates c
  JOIN public.products p
    ON p.tenant_id = c.tenant_id
   AND lower(p.id::text) LIKE c.prefix || '%'
  ORDER BY c.item_id, p.id
)
UPDATE public.fiscal_invoice_items fii
SET product_id = m.product_id
FROM matches m
WHERE fii.id = m.item_id
  AND fii.product_id IS NULL;