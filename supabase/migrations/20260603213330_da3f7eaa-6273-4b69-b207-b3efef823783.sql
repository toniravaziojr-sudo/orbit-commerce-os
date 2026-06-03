-- Propaga telefone do pedido para PVs fiscais antigos do tenant Respeite o Homem
-- que ficaram sem dest_telefone (impedindo emissão da Declaração de Conteúdo).
UPDATE public.fiscal_invoices p
SET dest_telefone = regexp_replace(o.customer_phone, '\D', '', 'g')
FROM public.orders o
WHERE p.order_id = o.id
  AND p.tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND (p.dest_telefone IS NULL OR btrim(p.dest_telefone) = '')
  AND o.customer_phone IS NOT NULL
  AND length(regexp_replace(o.customer_phone, '\D', '', 'g')) >= 10;