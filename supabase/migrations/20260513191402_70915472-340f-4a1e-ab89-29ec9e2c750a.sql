
-- 1) Dropar índice antigo (que ainda usava 'canceled' 1L) ANTES do UPDATE
DROP INDEX IF EXISTS public.idx_fiscal_invoices_order_unique;

-- 2) Migrar dados legados: 'canceled' (1 L) -> 'cancelled' (2 L)
UPDATE public.fiscal_invoices
SET status = 'cancelled'
WHERE status = 'canceled';

-- 3) Recriar índice de unicidade por pedido com critério correto.
--    Pedido pode ter apenas 1 NF ativa. 'cancelled' e 'rejected' NÃO contam.
CREATE UNIQUE INDEX idx_fiscal_invoices_order_unique
ON public.fiscal_invoices (tenant_id, order_id)
WHERE status NOT IN ('cancelled', 'rejected') AND order_id IS NOT NULL;

-- 4) CHECK constraint: bloquear escritas futuras com 'canceled' (1 L)
ALTER TABLE public.fiscal_invoices
DROP CONSTRAINT IF EXISTS fiscal_invoices_status_check;

ALTER TABLE public.fiscal_invoices
ADD CONSTRAINT fiscal_invoices_status_check
CHECK (status IN ('draft', 'pending', 'authorized', 'rejected', 'cancelled'));
