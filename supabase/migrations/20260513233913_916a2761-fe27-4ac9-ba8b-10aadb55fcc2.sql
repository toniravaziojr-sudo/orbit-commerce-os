
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reconcile_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reconcile_error text;

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_reconcile_pending
  ON public.fiscal_invoices (tenant_id, status, last_reconcile_at)
  WHERE status IN ('pending','processing','error') AND focus_ref IS NOT NULL;
