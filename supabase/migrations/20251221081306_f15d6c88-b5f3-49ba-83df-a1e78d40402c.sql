-- Tabela checkout_sessions para rastrear sessões de checkout
CREATE TABLE public.checkout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted', 'recovered', 'canceled')),
  abandoned_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  order_id UUID REFERENCES public.orders(id),
  cart_id TEXT,
  customer_id UUID REFERENCES public.customers(id),
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  region TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  total_estimated NUMERIC(12,2),
  items_snapshot JSONB DEFAULT '[]'::jsonb,
  utm JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_checkout_sessions_tenant_status_started ON public.checkout_sessions(tenant_id, status, started_at);
CREATE INDEX idx_checkout_sessions_tenant_status_abandoned ON public.checkout_sessions(tenant_id, status, abandoned_at);
CREATE INDEX idx_checkout_sessions_tenant_email ON public.checkout_sessions(tenant_id, customer_email);
CREATE INDEX idx_checkout_sessions_tenant_phone ON public.checkout_sessions(tenant_id, customer_phone);
CREATE INDEX idx_checkout_sessions_tenant_order ON public.checkout_sessions(tenant_id, order_id);
CREATE INDEX idx_checkout_sessions_tenant_cart ON public.checkout_sessions(tenant_id, cart_id);

-- Enable RLS
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: leitura para owners/admins do tenant
CREATE POLICY "checkout_sessions_select_policy"
ON public.checkout_sessions
FOR SELECT
USING (
  tenant_id = public.get_current_tenant_id(auth.uid())
  AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- Escrita via service role (Edge Functions)
CREATE POLICY "checkout_sessions_insert_service"
ON public.checkout_sessions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "checkout_sessions_update_service"
ON public.checkout_sessions
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_checkout_sessions_updated_at
BEFORE UPDATE ON public.checkout_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();