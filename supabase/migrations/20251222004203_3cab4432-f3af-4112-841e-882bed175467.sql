-- Tabela de cupons/descontos
CREATE TABLE public.discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- nullable para descontos automáticos futuros
  type TEXT NOT NULL CHECK (type IN ('order_percent', 'order_fixed', 'free_shipping')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_limit_total INTEGER, -- null = sem limite
  usage_limit_per_customer INTEGER, -- null = sem limite
  min_subtotal NUMERIC(10,2), -- null = sem mínimo
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para código por tenant (case-insensitive)
CREATE UNIQUE INDEX idx_discounts_tenant_code_unique 
  ON public.discounts (tenant_id, LOWER(code)) 
  WHERE code IS NOT NULL;

-- Índices de performance
CREATE INDEX idx_discounts_tenant_id ON public.discounts(tenant_id);
CREATE INDEX idx_discounts_active ON public.discounts(tenant_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Policies para discounts (apenas owners/admins do tenant)
CREATE POLICY "Tenant owners can manage discounts"
  ON public.discounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = discounts.tenant_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = discounts.tenant_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Tabela de resgates de desconto
CREATE TABLE public.discount_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('reserved', 'applied', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para redemptions
CREATE INDEX idx_discount_redemptions_tenant ON public.discount_redemptions(tenant_id);
CREATE INDEX idx_discount_redemptions_discount ON public.discount_redemptions(discount_id);
CREATE INDEX idx_discount_redemptions_customer ON public.discount_redemptions(tenant_id, LOWER(customer_email));
CREATE INDEX idx_discount_redemptions_order ON public.discount_redemptions(order_id) WHERE order_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies para redemptions (apenas owners/admins)
CREATE POLICY "Tenant owners can view redemptions"
  ON public.discount_redemptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = discount_redemptions.tenant_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_discounts_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para contar usos de um cupom
CREATE OR REPLACE FUNCTION public.get_discount_usage(p_discount_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.discount_redemptions
  WHERE discount_id = p_discount_id
    AND status IN ('reserved', 'applied');
$$;

-- Função para contar usos por cliente
CREATE OR REPLACE FUNCTION public.get_discount_usage_by_customer(p_discount_id UUID, p_email TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.discount_redemptions
  WHERE discount_id = p_discount_id
    AND LOWER(customer_email) = LOWER(p_email)
    AND status IN ('reserved', 'applied');
$$;