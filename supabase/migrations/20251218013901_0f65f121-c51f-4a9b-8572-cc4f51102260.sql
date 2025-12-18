-- =============================================
-- PAYMENT & SHIPPING PROVIDERS CONFIG TABLES
-- =============================================

-- Table: payment_providers - Gateway configurations per tenant
CREATE TABLE IF NOT EXISTS public.payment_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'pagarme', 'mercadopago'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' or 'production'
  credentials JSONB NOT NULL DEFAULT '{}', -- encrypted API keys stored here
  settings JSONB NOT NULL DEFAULT '{}', -- provider-specific settings
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- Table: payment_methods - Payment method configurations per tenant
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  method TEXT NOT NULL, -- 'pix', 'boleto', 'credit_card', 'mercadopago_wallet'
  provider_id UUID REFERENCES public.payment_providers(id) ON DELETE SET NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT NOT NULL, -- 'PIX', 'Boleto Bancário', etc.
  display_order INT NOT NULL DEFAULT 0,
  discount_type TEXT, -- 'percentage' or 'fixed'
  discount_value NUMERIC(10,2) DEFAULT 0,
  info_message TEXT, -- Informative message shown in checkout
  settings JSONB NOT NULL DEFAULT '{}', -- method-specific settings (installments, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, method)
);

-- Table: shipping_providers - Carrier configurations per tenant  
CREATE TABLE IF NOT EXISTS public.shipping_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'frenet', 'correios_contract', 'loggi', 'custom'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB NOT NULL DEFAULT '{}', -- API keys/tokens
  settings JSONB NOT NULL DEFAULT '{}', -- provider settings (origin_cep, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- Table: payment_transactions - Transaction records
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  checkout_id UUID REFERENCES public.checkouts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'pagarme', 'mercadopago'
  provider_transaction_id TEXT, -- ID from the gateway
  method TEXT NOT NULL, -- 'pix', 'boleto', 'credit_card'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'approved', 'declined', 'refunded', 'cancelled'
  amount NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  refunded_amount NUMERIC(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_data JSONB NOT NULL DEFAULT '{}', -- PIX code, boleto URL, card last4, etc.
  webhook_payload JSONB, -- Last webhook received
  error_message TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_providers_tenant ON public.payment_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_providers_tenant ON public.shipping_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON public.payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON public.payment_transactions(provider_transaction_id);

-- Enable RLS
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_providers
CREATE POLICY "Admins can manage payment providers" ON public.payment_providers
  FOR ALL USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

-- RLS Policies for payment_methods
CREATE POLICY "Admins can manage payment methods" ON public.payment_methods
  FOR ALL USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

CREATE POLICY "Anyone can view enabled payment methods" ON public.payment_methods
  FOR SELECT USING (is_enabled = true);

-- RLS Policies for shipping_providers
CREATE POLICY "Admins can manage shipping providers" ON public.shipping_providers
  FOR ALL USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

-- RLS Policies for payment_transactions
CREATE POLICY "Admins can manage payment transactions" ON public.payment_transactions
  FOR ALL USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
    has_role(auth.uid(), tenant_id, 'admin'::app_role) OR
    has_role(auth.uid(), tenant_id, 'operator'::app_role)
  );

CREATE POLICY "Users can view their tenant transactions" ON public.payment_transactions
  FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_providers_updated_at
  BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_providers_updated_at
  BEFORE UPDATE ON public.shipping_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();