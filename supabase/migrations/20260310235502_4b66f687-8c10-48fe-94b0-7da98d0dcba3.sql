
-- Payment method discount configuration per tenant
CREATE TABLE public.payment_method_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL, -- 'pix', 'boleto', 'credit_card'
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0, -- e.g. 5.00 for 5%
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  installments_max INTEGER DEFAULT 12, -- max installments for credit card
  installments_min_value_cents INTEGER DEFAULT 500, -- min value per installment
  description TEXT, -- optional description shown on checkout
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, payment_method)
);

-- RLS
ALTER TABLE public.payment_method_discounts ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own tenant's discounts
CREATE POLICY "Users can view own tenant payment discounts"
  ON public.payment_method_discounts
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- Policy: users can insert/update their own tenant's discounts
CREATE POLICY "Users can manage own tenant payment discounts"
  ON public.payment_method_discounts
  FOR ALL
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- Public read for storefront checkout (anon)
CREATE POLICY "Public can read enabled payment discounts"
  ON public.payment_method_discounts
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- Updated_at trigger
CREATE TRIGGER update_payment_method_discounts_updated_at
  BEFORE UPDATE ON public.payment_method_discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
