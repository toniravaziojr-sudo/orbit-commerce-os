
-- Audit table for email marketing sync attempts
CREATE TABLE public.email_marketing_sync_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  source TEXT NOT NULL,  -- 'order_approved', 'manual_create', 'import', 'reconciliation'
  status TEXT NOT NULL,  -- 'synced', 'skipped', 'failed'
  reason TEXT,           -- 'missing_email', 'subscriber_error', etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by tenant and status
CREATE INDEX idx_email_mkt_sync_audit_tenant_status 
  ON public.email_marketing_sync_audit (tenant_id, status, created_at DESC);

-- RLS
ALTER TABLE public.email_marketing_sync_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view sync audit"
  ON public.email_marketing_sync_audit
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Helper function to log sync audit entries (called from triggers and edge functions)
CREATE OR REPLACE FUNCTION public.log_marketing_sync_audit(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_source TEXT,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO email_marketing_sync_audit (tenant_id, customer_id, source, status, reason, metadata)
  VALUES (p_tenant_id, p_customer_id, p_source, p_status, p_reason, p_metadata);
END;
$$;

-- Update the order trigger to log skipped syncs
CREATE OR REPLACE FUNCTION public.trg_recalc_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
    IF NEW.customer_email IS NOT NULL AND TRIM(NEW.customer_email) != '' THEN
      -- Recalculate metrics
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);

      -- Sync subscriber only (does NOT create customer)
      PERFORM public.upsert_subscriber_only(
        NEW.tenant_id,
        NEW.customer_email,
        NEW.customer_name,
        NEW.customer_phone,
        NULL,
        'order',
        (SELECT l.id FROM public.email_marketing_lists l
         JOIN public.customer_tags t ON l.tag_id = t.id
         WHERE l.tenant_id = NEW.tenant_id AND t.name = 'Cliente'
         LIMIT 1)
      );
    ELSE
      -- Customer without valid email: log auditable skip
      PERFORM public.log_marketing_sync_audit(
        NEW.tenant_id,
        NEW.customer_id,
        'order_approved',
        'skipped',
        'missing_email',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
