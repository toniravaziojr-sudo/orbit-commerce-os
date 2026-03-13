
-- ============================================
-- ORDER PRICE AUDIT — Canonical price validation (Security Plan v3.1 Phase 2B)
-- Compares frontend-submitted totals vs server-calculated (canonical) totals
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_price_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Frontend-submitted values
  submitted_subtotal numeric NOT NULL DEFAULT 0,
  submitted_shipping numeric NOT NULL DEFAULT 0,
  submitted_discount numeric NOT NULL DEFAULT 0,
  submitted_payment_discount numeric NOT NULL DEFAULT 0,
  submitted_total numeric NOT NULL DEFAULT 0,
  
  -- Server-calculated (canonical) values
  canonical_subtotal numeric NOT NULL DEFAULT 0,
  canonical_shipping numeric NOT NULL DEFAULT 0,
  canonical_discount numeric NOT NULL DEFAULT 0,
  canonical_total numeric NOT NULL DEFAULT 0,
  
  -- Drift detection
  subtotal_drift numeric GENERATED ALWAYS AS (submitted_subtotal - canonical_subtotal) STORED,
  total_drift numeric GENERATED ALWAYS AS (submitted_total - canonical_total) STORED,
  has_drift boolean GENERATED ALWAYS AS (
    submitted_subtotal != canonical_subtotal OR submitted_total != canonical_total
  ) STORED,
  
  -- Metadata
  shipping_quote_id uuid REFERENCES public.shipping_quotes(id),
  discount_id uuid,
  validation_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_order_price_audit_order_id ON public.order_price_audit(order_id);
CREATE INDEX idx_order_price_audit_tenant_id ON public.order_price_audit(tenant_id);
CREATE INDEX idx_order_price_audit_has_drift ON public.order_price_audit(has_drift) WHERE has_drift = true;

-- RLS
ALTER TABLE public.order_price_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read (no client access)
-- No policies = only service role can access

-- Add canonical_total column to orders for charge functions to use
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS canonical_total numeric;
