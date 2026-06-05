
-- Substitui o índice único que impedia o modelo Bling (PV + NF para o mesmo pedido)
DROP INDEX IF EXISTS public.idx_fiscal_invoices_order_unique;

-- Um único PV ativo por pedido
CREATE UNIQUE INDEX idx_fiscal_invoices_order_unique_pv
  ON public.fiscal_invoices (tenant_id, order_id)
  WHERE status <> ALL (ARRAY['cancelled'::text,'rejected'::text])
    AND order_id IS NOT NULL
    AND fiscal_stage = 'pedido_venda';

-- Uma única NF ativa por pedido (qualquer estágio diferente de PV)
CREATE UNIQUE INDEX idx_fiscal_invoices_order_unique_nf
  ON public.fiscal_invoices (tenant_id, order_id)
  WHERE status <> ALL (ARRAY['cancelled'::text,'rejected'::text])
    AND order_id IS NOT NULL
    AND (fiscal_stage IS NULL OR fiscal_stage <> 'pedido_venda');
