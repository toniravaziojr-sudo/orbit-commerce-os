-- Etapa C: ligação Pedido de Venda -> Nota Fiscal (modelo Bling, 2 registros)
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS source_order_invoice_id uuid NULL REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_source_order_invoice_id
  ON public.fiscal_invoices(source_order_invoice_id)
  WHERE source_order_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.fiscal_invoices.source_order_invoice_id IS
  'Quando esta NF foi criada a partir de um Pedido de Venda (fiscal_stage=pedido_venda), aponta para o registro de origem. O pedido permanece intacto como fonte de verdade operacional; esta NF é o snapshot fiscal.';