
CREATE TABLE public.mp_pending_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  checkout_session_id TEXT,
  mp_preference_id TEXT,
  customer_data JSONB NOT NULL DEFAULT '{}',
  shipping_data JSONB NOT NULL DEFAULT '{}',
  items_data JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping_total NUMERIC NOT NULL DEFAULT 0,
  discount_total NUMERIC NOT NULL DEFAULT 0,
  payment_method_discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  discount_data JSONB,
  attribution_data JSONB,
  affiliate_data JSONB,
  shipping_quote_id TEXT,
  checkout_attempt_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  order_id UUID,
  mp_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mp_pending_checkouts ENABLE ROW LEVEL SECURITY;

-- Public read (checkout thank you page needs to check status)
CREATE POLICY "Anyone can read pending checkouts"
ON public.mp_pending_checkouts FOR SELECT
USING (true);

-- Auto-expire old pending checkouts (cleanup)
CREATE INDEX idx_mp_pending_checkouts_tenant ON public.mp_pending_checkouts(tenant_id);
CREATE INDEX idx_mp_pending_checkouts_status ON public.mp_pending_checkouts(status, created_at);

CREATE TRIGGER update_mp_pending_checkouts_updated_at
BEFORE UPDATE ON public.mp_pending_checkouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
