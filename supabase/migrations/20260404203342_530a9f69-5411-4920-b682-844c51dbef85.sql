
-- 1. Create the fiscal_draft_queue table
CREATE TABLE public.fiscal_draft_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT fiscal_draft_queue_order_unique UNIQUE (order_id)
);

CREATE INDEX idx_fiscal_draft_queue_pending ON public.fiscal_draft_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_fiscal_draft_queue_tenant ON public.fiscal_draft_queue (tenant_id);

-- 2. Enable RLS — only service_role can access
ALTER TABLE public.fiscal_draft_queue ENABLE ROW LEVEL SECURITY;

-- 3. Drop the old pg_net trigger and function
DROP TRIGGER IF EXISTS trg_fiscal_draft_on_payment_approved ON public.orders;
DROP FUNCTION IF EXISTS public.trg_fiscal_draft_on_payment_approved();

-- 4. Create new lightweight trigger function
CREATE OR REPLACE FUNCTION public.enqueue_fiscal_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when payment_status changes to 'approved'
  IF (TG_OP = 'UPDATE'
      AND NEW.payment_status = 'approved'
      AND (OLD.payment_status IS DISTINCT FROM 'approved'))
  THEN
    INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
    VALUES (NEW.tenant_id, NEW.id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create the trigger
CREATE TRIGGER trg_enqueue_fiscal_draft
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_fiscal_draft();
