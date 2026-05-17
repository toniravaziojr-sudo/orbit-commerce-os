
WITH src AS (
  SELECT
    it.id AS item_id,
    p.ncm AS p_ncm,
    p.cest AS p_cest,
    NULLIF(regexp_replace(coalesce(p.origin_code::text,''), '\D','','g'),'')::int AS p_origem
  FROM public.fiscal_invoice_items it
  JOIN public.fiscal_invoices inv ON inv.id = it.invoice_id
  JOIN public.order_items oi ON oi.id = it.order_item_id
  JOIN public.products p ON p.id = oi.product_id
  WHERE inv.fiscal_stage = 'pedido_venda'
    AND inv.status = 'draft'
    AND (it.ncm IS NULL OR it.ncm = '')
)
UPDATE public.fiscal_invoice_items AS it
SET
  ncm = COALESCE(NULLIF(it.ncm, ''), src.p_ncm, ''),
  cest = COALESCE(NULLIF(it.cest, ''), src.p_cest),
  origem = CASE WHEN it.origem IS NULL OR it.origem = 0
                THEN COALESCE(src.p_origem, it.origem, 0)
                ELSE it.origem END
FROM src
WHERE src.item_id = it.id;

UPDATE public.fiscal_invoices
SET pendencia_motivos = public.compute_pedido_venda_pendencias(id)
WHERE fiscal_stage = 'pedido_venda'
  AND status = 'draft';
