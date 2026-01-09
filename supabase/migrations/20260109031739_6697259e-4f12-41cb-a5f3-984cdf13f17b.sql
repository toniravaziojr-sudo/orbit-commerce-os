-- ===========================================
-- BILLING TABLES FOR COMANDO CENTRAL
-- ===========================================

-- 1) billing_plans - Catálogo de planos
CREATE TABLE IF NOT EXISTS public.billing_plans (
  plan_key TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_annual_cents INTEGER NOT NULL DEFAULT 0,
  included_orders_per_month INTEGER,
  support_level TEXT DEFAULT 'email',
  feature_bullets JSONB DEFAULT '[]'::jsonb,
  mp_plan_id_monthly TEXT,
  mp_plan_id_annual TEXT,
  is_recommended BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- Public read for active public plans (para endpoint public-plans)
CREATE POLICY "Anyone can read active public plans"
ON public.billing_plans
FOR SELECT
USING (is_active = true AND is_public = true);

-- Platform admins can manage plans
CREATE POLICY "Platform admins can manage billing plans"
ON public.billing_plans
FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 2) Alterar tenant_subscriptions para suportar Mercado Pago
-- Primeiro verificar se a tabela existe e adicionar colunas necessárias

-- Adicionar colunas de Mercado Pago se não existirem
DO $$
BEGIN
  -- billing_cycle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions' AND column_name = 'billing_cycle') THEN
    ALTER TABLE public.tenant_subscriptions ADD COLUMN billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual'));
  END IF;
  
  -- mp_preapproval_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions' AND column_name = 'mp_preapproval_id') THEN
    ALTER TABLE public.tenant_subscriptions ADD COLUMN mp_preapproval_id TEXT;
  END IF;
  
  -- mp_customer_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions' AND column_name = 'mp_customer_id') THEN
    ALTER TABLE public.tenant_subscriptions ADD COLUMN mp_customer_id TEXT;
  END IF;
  
  -- mp_payment_method
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions' AND column_name = 'mp_payment_method') THEN
    ALTER TABLE public.tenant_subscriptions ADD COLUMN mp_payment_method JSONB;
  END IF;
  
  -- current_period_start
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions' AND column_name = 'current_period_start') THEN
    ALTER TABLE public.tenant_subscriptions ADD COLUMN current_period_start TIMESTAMPTZ;
  END IF;
  
  -- current_period_end
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions' AND column_name = 'current_period_end') THEN
    ALTER TABLE public.tenant_subscriptions ADD COLUMN current_period_end TIMESTAMPTZ;
  END IF;
END $$;

-- 3) billing_events - Auditoria de webhooks
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

-- Enable RLS
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read billing events
CREATE POLICY "Platform admins can read billing events"
ON public.billing_events
FOR SELECT
USING (public.is_platform_admin());

-- Service role inserts (via edge functions)
CREATE POLICY "Service role can insert billing events"
ON public.billing_events
FOR INSERT
WITH CHECK (true);

-- 4) Seed inicial dos planos
INSERT INTO public.billing_plans (plan_key, name, description, price_monthly_cents, price_annual_cents, included_orders_per_month, support_level, feature_bullets, is_recommended, sort_order)
VALUES
  ('free', 'Gratuito', 'Para começar a vender online', 0, 0, 10, 'email', 
   '["Até 10 pedidos/mês", "1 usuário", "Loja virtual básica", "Suporte por email"]'::jsonb, 
   false, 1),
  ('start', 'Start', 'Para pequenos negócios', 9900, 99000, 100, 'email', 
   '["Até 100 pedidos/mês", "3 usuários", "Loja virtual completa", "Domínio próprio", "Suporte por email"]'::jsonb, 
   false, 2),
  ('growth', 'Growth', 'Para negócios em crescimento', 19900, 199000, 500, 'whatsapp', 
   '["Até 500 pedidos/mês", "10 usuários", "Todas as integrações", "Automações", "Suporte por WhatsApp"]'::jsonb, 
   true, 3),
  ('scale', 'Scale', 'Para operações maiores', 49900, 499000, 2000, 'priority', 
   '["Até 2.000 pedidos/mês", "Usuários ilimitados", "API completa", "Relatórios avançados", "Suporte prioritário"]'::jsonb, 
   false, 4),
  ('enterprise', 'Enterprise', 'Para grandes operações', 99900, 999000, NULL, 'dedicated', 
   '["Pedidos ilimitados", "Usuários ilimitados", "SLA dedicado", "Customizações", "Gerente de conta"]'::jsonb, 
   false, 5)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_annual_cents = EXCLUDED.price_annual_cents,
  included_orders_per_month = EXCLUDED.included_orders_per_month,
  support_level = EXCLUDED.support_level,
  feature_bullets = EXCLUDED.feature_bullets,
  is_recommended = EXCLUDED.is_recommended,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();