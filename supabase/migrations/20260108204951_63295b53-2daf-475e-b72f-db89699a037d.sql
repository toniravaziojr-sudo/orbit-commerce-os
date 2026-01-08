-- =====================================================
-- SISTEMA DE PLANOS E BILLING - COMANDO CENTRAL
-- =====================================================

-- 1. TABELA DE PLANOS (catálogo)
CREATE TABLE public.plans (
  plan_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_fee_cents INTEGER NOT NULL DEFAULT 0,
  fee_bps INTEGER NOT NULL DEFAULT 0, -- basis points (350 = 3.5%)
  order_limit INTEGER, -- NULL = ilimitado/negociado
  support_level TEXT NOT NULL DEFAULT 'standard',
  features JSONB DEFAULT '[]'::jsonb,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed dos planos
INSERT INTO public.plans (plan_key, name, description, monthly_fee_cents, fee_bps, order_limit, support_level, is_custom, sort_order) VALUES
  ('free', 'Free', 'Ideal para começar', 0, 350, 100, 'community', false, 1),
  ('standard', 'Standard', 'Para negócios em crescimento', 4990, 200, 600, 'email', false, 2),
  ('scale', 'Scale', 'Para operações maiores', 8990, 150, 1500, 'priority', false, 3),
  ('enterprise', 'Enterprise', 'Para alta performance', 12990, 100, 3000, 'dedicated', false, 4),
  ('custom', 'Custom', 'Sob medida para seu negócio', 0, 0, NULL, 'dedicated', true, 5);

-- 2. ENUM PARA STATUS DE ASSINATURA
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('pending_payment_method', 'active', 'suspended', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. TABELA DE ASSINATURAS (tenant_subscriptions)
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL REFERENCES public.plans(plan_key),
  status subscription_status NOT NULL DEFAULT 'pending_payment_method',
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  -- Billing provider fields
  payment_method_type TEXT, -- 'card', 'pix', 'boleto'
  payment_provider TEXT, -- 'pagarme', 'stripe', etc.
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  card_last_four TEXT,
  card_brand TEXT,
  -- UTM tracking
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 4. TABELA DE USO MENSAL (tenant_monthly_usage)
CREATE TABLE public.tenant_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- formato: '2025-01'
  orders_count INTEGER NOT NULL DEFAULT 0,
  gmv_cents BIGINT NOT NULL DEFAULT 0, -- valor total de vendas em centavos
  ai_usage_cents INTEGER NOT NULL DEFAULT 0, -- consumo de IA em centavos
  over_limit BOOLEAN NOT NULL DEFAULT false,
  limit_warning_shown_at TIMESTAMPTZ,
  limit_blocked_at TIMESTAMPTZ, -- para enforcement hard (futuro)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, year_month)
);

-- 5. ENUM PARA STATUS DE FATURA
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. TABELA DE FATURAS (tenant_invoices)
CREATE TABLE public.tenant_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- formato: '2025-01'
  -- Valores em centavos
  base_fee_cents INTEGER NOT NULL DEFAULT 0, -- mensalidade
  variable_fee_cents INTEGER NOT NULL DEFAULT 0, -- % sobre vendas
  ai_fee_cents INTEGER NOT NULL DEFAULT 0, -- consumo IA
  addons_cents INTEGER NOT NULL DEFAULT 0, -- add-ons
  discount_cents INTEGER NOT NULL DEFAULT 0, -- descontos
  total_cents INTEGER NOT NULL DEFAULT 0,
  -- Status e pagamento
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_provider_id TEXT,
  -- Detalhes
  line_items JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, year_month)
);

-- 7. TABELA DE ADD-ONS (tenant_addons)
CREATE TABLE public.tenant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL, -- 'setup_essential', 'setup_complete', etc.
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'delivered', 'cancelled'
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TABELA DE VALIDAÇÃO PIX FREE (free_pix_validations)
CREATE TABLE public.free_pix_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 10000, -- R$100 = 10000 centavos
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'refund_requested', 'refunded', 'expired'
  pix_code TEXT,
  pix_qr_code TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  refundable_until TIMESTAMPTZ,
  refund_requested_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  payment_provider TEXT,
  provider_charge_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. FEATURE FLAGS PARA BILLING
CREATE TABLE public.billing_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed feature flags
INSERT INTO public.billing_feature_flags (flag_key, is_enabled, description) VALUES
  ('hard_order_limit_enforcement', false, 'Quando true, bloqueia operação ao atingir limite'),
  ('auto_invoice_generation', true, 'Gerar faturas automaticamente no fim do mês'),
  ('pix_validation_for_free', true, 'Exigir validação Pix para plano Free sem cartão');

-- 10. INDEXES PARA PERFORMANCE
CREATE INDEX idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);
CREATE INDEX idx_tenant_monthly_usage_tenant_month ON public.tenant_monthly_usage(tenant_id, year_month);
CREATE INDEX idx_tenant_invoices_tenant_month ON public.tenant_invoices(tenant_id, year_month);
CREATE INDEX idx_tenant_invoices_status ON public.tenant_invoices(status);
CREATE INDEX idx_tenant_addons_tenant ON public.tenant_addons(tenant_id);
CREATE INDEX idx_free_pix_validations_tenant ON public.free_pix_validations(tenant_id);
CREATE INDEX idx_free_pix_validations_status ON public.free_pix_validations(status);

-- 11. RLS POLICIES

-- Plans: leitura pública (catálogo)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans são públicos para leitura"
  ON public.plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins podem gerenciar planos"
  ON public.plans FOR ALL
  USING (public.is_platform_admin());

-- Tenant Subscriptions
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver assinatura do próprio tenant"
  ON public.tenant_subscriptions FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins do tenant podem gerenciar assinatura"
  ON public.tenant_subscriptions FOR ALL
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner') OR
    public.has_role(auth.uid(), tenant_id, 'admin')
  );

CREATE POLICY "Platform admins podem ver todas assinaturas"
  ON public.tenant_subscriptions FOR SELECT
  USING (public.is_platform_admin());

-- Tenant Monthly Usage
ALTER TABLE public.tenant_monthly_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver uso do próprio tenant"
  ON public.tenant_monthly_usage FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Sistema pode inserir/atualizar uso"
  ON public.tenant_monthly_usage FOR ALL
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner') OR
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.is_platform_admin()
  );

-- Tenant Invoices
ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver faturas do próprio tenant"
  ON public.tenant_invoices FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins podem gerenciar faturas"
  ON public.tenant_invoices FOR ALL
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner') OR
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.is_platform_admin()
  );

-- Tenant Addons
ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver addons do próprio tenant"
  ON public.tenant_addons FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins podem gerenciar addons"
  ON public.tenant_addons FOR ALL
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner') OR
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.is_platform_admin()
  );

-- Free Pix Validations
ALTER TABLE public.free_pix_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver validações do próprio tenant"
  ON public.free_pix_validations FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins podem gerenciar validações"
  ON public.free_pix_validations FOR ALL
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner') OR
    public.has_role(auth.uid(), tenant_id, 'admin') OR
    public.is_platform_admin()
  );

-- Billing Feature Flags
ALTER TABLE public.billing_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler feature flags"
  ON public.billing_feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Apenas platform admins podem modificar"
  ON public.billing_feature_flags FOR ALL
  USING (public.is_platform_admin());

-- 12. TRIGGERS PARA UPDATED_AT
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_monthly_usage_updated_at
  BEFORE UPDATE ON public.tenant_monthly_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_invoices_updated_at
  BEFORE UPDATE ON public.tenant_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_addons_updated_at
  BEFORE UPDATE ON public.tenant_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_free_pix_validations_updated_at
  BEFORE UPDATE ON public.free_pix_validations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_feature_flags_updated_at
  BEFORE UPDATE ON public.billing_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. FUNÇÃO PARA OBTER YEAR_MONTH ATUAL
CREATE OR REPLACE FUNCTION public.get_current_year_month()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT TO_CHAR(NOW(), 'YYYY-MM');
$$;

-- 14. FUNÇÃO PARA INCREMENTAR USO MENSAL (chamada ao criar pedido)
CREATE OR REPLACE FUNCTION public.increment_tenant_order_usage(
  p_tenant_id UUID,
  p_order_total_cents BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year_month TEXT;
  v_plan_key TEXT;
  v_order_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  v_year_month := public.get_current_year_month();
  
  -- Upsert no uso mensal
  INSERT INTO public.tenant_monthly_usage (tenant_id, year_month, orders_count, gmv_cents)
  VALUES (p_tenant_id, v_year_month, 1, p_order_total_cents)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    orders_count = tenant_monthly_usage.orders_count + 1,
    gmv_cents = tenant_monthly_usage.gmv_cents + p_order_total_cents,
    updated_at = now();
  
  -- Verificar se passou do limite
  SELECT ts.plan_key, p.order_limit, tmu.orders_count
  INTO v_plan_key, v_order_limit, v_current_count
  FROM public.tenant_subscriptions ts
  JOIN public.plans p ON p.plan_key = ts.plan_key
  LEFT JOIN public.tenant_monthly_usage tmu ON tmu.tenant_id = ts.tenant_id AND tmu.year_month = v_year_month
  WHERE ts.tenant_id = p_tenant_id;
  
  -- Marcar over_limit se ultrapassou
  IF v_order_limit IS NOT NULL AND v_current_count > v_order_limit THEN
    UPDATE public.tenant_monthly_usage
    SET over_limit = true
    WHERE tenant_id = p_tenant_id AND year_month = v_year_month;
  END IF;
END;
$$;

-- 15. FUNÇÃO PARA REGISTRAR USO DE IA
CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_tenant_id UUID,
  p_usage_cents INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year_month TEXT;
BEGIN
  v_year_month := public.get_current_year_month();
  
  INSERT INTO public.tenant_monthly_usage (tenant_id, year_month, ai_usage_cents)
  VALUES (p_tenant_id, v_year_month, p_usage_cents)
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_usage_cents = tenant_monthly_usage.ai_usage_cents + p_usage_cents,
    updated_at = now();
END;
$$;

-- 16. FUNÇÃO PARA GERAR FATURA MENSAL
CREATE OR REPLACE FUNCTION public.generate_tenant_invoice(
  p_tenant_id UUID,
  p_year_month TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_id UUID;
  v_plan_key TEXT;
  v_monthly_fee INTEGER;
  v_fee_bps INTEGER;
  v_gmv BIGINT;
  v_ai_usage INTEGER;
  v_addons_total INTEGER;
  v_variable_fee INTEGER;
  v_total INTEGER;
  v_line_items JSONB;
BEGIN
  -- Buscar dados do plano
  SELECT ts.plan_key, p.monthly_fee_cents, p.fee_bps
  INTO v_plan_key, v_monthly_fee, v_fee_bps
  FROM public.tenant_subscriptions ts
  JOIN public.plans p ON p.plan_key = ts.plan_key
  WHERE ts.tenant_id = p_tenant_id;
  
  IF v_plan_key IS NULL THEN
    RAISE EXCEPTION 'Tenant não possui assinatura ativa';
  END IF;
  
  -- Buscar uso mensal
  SELECT COALESCE(gmv_cents, 0), COALESCE(ai_usage_cents, 0)
  INTO v_gmv, v_ai_usage
  FROM public.tenant_monthly_usage
  WHERE tenant_id = p_tenant_id AND year_month = p_year_month;
  
  v_gmv := COALESCE(v_gmv, 0);
  v_ai_usage := COALESCE(v_ai_usage, 0);
  
  -- Calcular fee variável (bps = basis points, 100bps = 1%)
  v_variable_fee := (v_gmv * v_fee_bps / 10000)::INTEGER;
  
  -- Buscar addons pendentes
  SELECT COALESCE(SUM(price_cents), 0)
  INTO v_addons_total
  FROM public.tenant_addons
  WHERE tenant_id = p_tenant_id AND status = 'pending';
  
  -- Calcular total
  v_total := v_monthly_fee + v_variable_fee + v_ai_usage + v_addons_total;
  
  -- Montar line items
  v_line_items := jsonb_build_array(
    jsonb_build_object('type', 'base_fee', 'description', 'Mensalidade ' || v_plan_key, 'amount_cents', v_monthly_fee),
    jsonb_build_object('type', 'variable_fee', 'description', 'Taxa sobre vendas (' || (v_fee_bps::DECIMAL / 100) || '%)', 'amount_cents', v_variable_fee),
    jsonb_build_object('type', 'ai_usage', 'description', 'Consumo de IA', 'amount_cents', v_ai_usage),
    jsonb_build_object('type', 'addons', 'description', 'Add-ons', 'amount_cents', v_addons_total)
  );
  
  -- Inserir ou atualizar fatura
  INSERT INTO public.tenant_invoices (
    tenant_id, year_month, base_fee_cents, variable_fee_cents, ai_fee_cents, 
    addons_cents, total_cents, status, line_items, due_date
  ) VALUES (
    p_tenant_id, p_year_month, v_monthly_fee, v_variable_fee, v_ai_usage,
    v_addons_total, v_total, 'open', v_line_items, 
    (TO_DATE(p_year_month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' + INTERVAL '5 days')::DATE
  )
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    base_fee_cents = EXCLUDED.base_fee_cents,
    variable_fee_cents = EXCLUDED.variable_fee_cents,
    ai_fee_cents = EXCLUDED.ai_fee_cents,
    addons_cents = EXCLUDED.addons_cents,
    total_cents = EXCLUDED.total_cents,
    line_items = EXCLUDED.line_items,
    status = CASE WHEN tenant_invoices.status = 'paid' THEN 'paid' ELSE 'open' END,
    updated_at = now()
  RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;

-- 17. FUNÇÃO PARA VERIFICAR LIMITE DO TENANT
CREATE OR REPLACE FUNCTION public.check_tenant_order_limit(p_tenant_id UUID)
RETURNS TABLE(
  is_over_limit BOOLEAN,
  current_count INTEGER,
  order_limit INTEGER,
  plan_key TEXT,
  hard_enforcement_enabled BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year_month TEXT;
  v_hard_enforcement BOOLEAN;
BEGIN
  v_year_month := public.get_current_year_month();
  
  -- Verificar feature flag
  SELECT is_enabled INTO v_hard_enforcement
  FROM public.billing_feature_flags
  WHERE flag_key = 'hard_order_limit_enforcement';
  
  RETURN QUERY
  SELECT 
    COALESCE(tmu.over_limit, false) AS is_over_limit,
    COALESCE(tmu.orders_count, 0)::INTEGER AS current_count,
    p.order_limit,
    ts.plan_key,
    COALESCE(v_hard_enforcement, false) AS hard_enforcement_enabled
  FROM public.tenant_subscriptions ts
  JOIN public.plans p ON p.plan_key = ts.plan_key
  LEFT JOIN public.tenant_monthly_usage tmu ON tmu.tenant_id = ts.tenant_id AND tmu.year_month = v_year_month
  WHERE ts.tenant_id = p_tenant_id;
END;
$$;