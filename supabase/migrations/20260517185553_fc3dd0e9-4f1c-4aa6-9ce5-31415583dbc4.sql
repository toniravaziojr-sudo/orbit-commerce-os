
-- ============================================================
-- Separação da numeração: Pedido de Venda × Nota Fiscal
-- Numeração monotônica (não reaproveita número excluído)
-- ============================================================

-- 1) Coluna de cursor próprio para Pedido de Venda
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS numero_pedido_atual integer NOT NULL DEFAULT 1;

-- 2) Inicializar cursor por tenant a partir do maior pedido existente
UPDATE public.fiscal_settings fs
SET numero_pedido_atual = COALESCE((
  SELECT MAX(fi.numero) + 1
  FROM public.fiscal_invoices fi
  WHERE fi.tenant_id = fs.tenant_id
    AND fi.fiscal_stage = 'pedido_venda'
    AND fi.numero > 0
), 1);

-- 3) Remover índice único atual (mistura Pedido e NF)
DROP INDEX IF EXISTS public.fiscal_invoices_numero_unique;

-- 4) Recriar como dois índices parciais — Pedido e NF têm sequências independentes
CREATE UNIQUE INDEX fiscal_invoices_numero_pedido_unique
  ON public.fiscal_invoices (tenant_id, serie, numero)
  WHERE numero > 0 AND fiscal_stage = 'pedido_venda';

CREATE UNIQUE INDEX fiscal_invoices_numero_nf_unique
  ON public.fiscal_invoices (tenant_id, serie, numero)
  WHERE numero > 0 AND (fiscal_stage IS NULL OR fiscal_stage <> 'pedido_venda');
