
-- 1. Add 'draft' to delivery_status enum
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'label_created';

-- 2. Create shipping_draft_queue table
CREATE TABLE public.shipping_draft_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT shipping_draft_queue_order_unique UNIQUE (order_id)
);

CREATE INDEX idx_shipping_draft_queue_pending ON public.shipping_draft_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_shipping_draft_queue_tenant ON public.shipping_draft_queue (tenant_id);

-- 3. Enable RLS — only service_role can access
ALTER TABLE public.shipping_draft_queue ENABLE ROW LEVEL SECURITY;

-- 4. Add columns to shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS label_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_shipment_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.fiscal_invoices(id),
  ADD COLUMN IF NOT EXISTS service_code TEXT,
  ADD COLUMN IF NOT EXISTS nfe_key TEXT;

-- 5. Make tracking_code nullable (drafts won't have it yet)
ALTER TABLE public.shipments ALTER COLUMN tracking_code DROP NOT NULL;
ALTER TABLE public.shipments ALTER COLUMN tracking_code SET DEFAULT '';

-- 6. Expand trigger function to also enqueue shipping drafts
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
    -- Fiscal draft queue (existing)
    INSERT INTO public.fiscal_draft_queue (tenant_id, order_id)
    VALUES (NEW.tenant_id, NEW.id)
    ON CONFLICT (order_id) DO NOTHING;

    -- Shipping draft queue (NEW)
    INSERT INTO public.shipping_draft_queue (tenant_id, order_id, provider)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      COALESCE(LOWER(TRIM(NEW.shipping_carrier)), 'manual')
    )
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
