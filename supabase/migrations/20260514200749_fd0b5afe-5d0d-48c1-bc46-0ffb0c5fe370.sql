
-- Add fiscal_stage column for operational pipeline (separate from official fiscal status)
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS fiscal_stage TEXT NOT NULL DEFAULT 'pedido_venda',
  ADD COLUMN IF NOT EXISTS pendencia_motivos JSONB;

-- Backfill: drafts -> pedido_venda; everything else -> emitida
UPDATE public.fiscal_invoices
SET fiscal_stage = CASE
  WHEN status = 'draft' THEN 'pedido_venda'
  ELSE 'emitida'
END
WHERE fiscal_stage = 'pedido_venda' OR fiscal_stage IS NULL;

-- CHECK constraint
ALTER TABLE public.fiscal_invoices
  DROP CONSTRAINT IF EXISTS fiscal_invoices_fiscal_stage_check;
ALTER TABLE public.fiscal_invoices
  ADD CONSTRAINT fiscal_invoices_fiscal_stage_check
  CHECK (fiscal_stage IN ('pedido_venda', 'pronta_emitir', 'pendencia', 'emitida'));

-- Index by tenant + stage for tab listing
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_tenant_stage
  ON public.fiscal_invoices (tenant_id, fiscal_stage, created_at DESC);

COMMENT ON COLUMN public.fiscal_invoices.fiscal_stage IS
  'Operational pipeline stage: pedido_venda (draft order, in PV tab) | pronta_emitir (validated, awaiting transmission) | pendencia (validation failed, blocked) | emitida (transmission attempted/done). Independent from official fiscal status.';
COMMENT ON COLUMN public.fiscal_invoices.pendencia_motivos IS
  'JSON array of validation issues blocking transmission. Populated when fiscal_stage=pendencia.';
