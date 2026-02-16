
-- =============================================
-- Sprint 1: Fundação do Banco de Dados v4.0
-- =============================================

-- 1.1 Nova tabela normalizada: config por conta de anúncios
CREATE TABLE public.ads_autopilot_account_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text NOT NULL,
  ad_account_id text NOT NULL,
  is_ai_enabled boolean DEFAULT false,
  budget_mode text DEFAULT 'monthly',
  budget_cents integer DEFAULT 0,
  target_roi numeric(6,2),
  min_roi_cold numeric(6,2) DEFAULT 2.0,
  min_roi_warm numeric(6,2) DEFAULT 3.0,
  user_instructions text DEFAULT '',
  strategy_mode text DEFAULT 'balanced',
  funnel_split_mode text DEFAULT 'manual',
  funnel_splits jsonb DEFAULT '{"cold":60,"remarketing":25,"tests":15,"leads":0}',
  kill_switch boolean DEFAULT false,
  human_approval_mode text DEFAULT 'auto',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, channel, ad_account_id)
);

-- 1.2 Colunas globais em ads_autopilot_configs
ALTER TABLE public.ads_autopilot_configs
  ADD COLUMN IF NOT EXISTS strategy_mode text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS funnel_split_mode text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS funnel_splits jsonb DEFAULT '{"cold":60,"remarketing":25,"tests":15,"leads":0}',
  ADD COLUMN IF NOT EXISTS kill_switch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_approval_mode text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS total_budget_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_budget_mode text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS channel_limits jsonb DEFAULT '{"meta":{"min_pct":0,"max_pct":100},"google":{"min_pct":0,"max_pct":100},"tiktok":{"min_pct":0,"max_pct":100}}';

-- 1.3 Tabela de Insights Semanais
CREATE TABLE public.ads_autopilot_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text NOT NULL,
  ad_account_id text,
  title text NOT NULL,
  body text NOT NULL,
  evidence jsonb DEFAULT '{}',
  recommended_action jsonb DEFAULT '{}',
  priority text DEFAULT 'medium',
  category text DEFAULT 'general',
  sentiment text DEFAULT 'neutral',
  status text DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 1.4 Tabela de Experimentos
CREATE TABLE public.ads_autopilot_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text NOT NULL,
  ad_account_id text,
  hypothesis text NOT NULL,
  variable_type text NOT NULL,
  plan jsonb DEFAULT '{}',
  budget_cents integer DEFAULT 0,
  duration_days integer DEFAULT 7,
  min_spend_cents integer DEFAULT 0,
  min_conversions integer DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  success_criteria jsonb DEFAULT '{}',
  status text DEFAULT 'planned',
  results jsonb DEFAULT '{}',
  winner_variant_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.5 Tabela de Creative Assets
CREATE TABLE public.ads_creative_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text,
  ad_account_id text,
  product_id uuid REFERENCES public.products(id),
  experiment_id uuid,
  asset_url text,
  storage_path text,
  format text,
  aspect_ratio text,
  angle text,
  copy_text text,
  headline text,
  cta_type text,
  variation_of uuid,
  platform_ad_id text,
  status text DEFAULT 'draft',
  performance jsonb DEFAULT '{}',
  compliance_status text DEFAULT 'pending',
  compliance_notes text,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.6 Tabela de Tracking Health
CREATE TABLE public.ads_tracking_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text NOT NULL,
  ad_account_id text,
  status text DEFAULT 'unknown',
  indicators jsonb DEFAULT '{}',
  alerts jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- RLS para todas as novas tabelas
-- =============================================

ALTER TABLE public.ads_autopilot_account_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_autopilot_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_autopilot_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_tracking_health ENABLE ROW LEVEL SECURITY;

-- ads_autopilot_account_configs
CREATE POLICY "Users can view own tenant account configs"
  ON public.ads_autopilot_account_configs FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant account configs"
  ON public.ads_autopilot_account_configs FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant account configs"
  ON public.ads_autopilot_account_configs FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant account configs"
  ON public.ads_autopilot_account_configs FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- ads_autopilot_insights
CREATE POLICY "Users can view own tenant insights"
  ON public.ads_autopilot_insights FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant insights"
  ON public.ads_autopilot_insights FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant insights"
  ON public.ads_autopilot_insights FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

-- ads_autopilot_experiments
CREATE POLICY "Users can view own tenant experiments"
  ON public.ads_autopilot_experiments FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant experiments"
  ON public.ads_autopilot_experiments FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant experiments"
  ON public.ads_autopilot_experiments FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

-- ads_creative_assets
CREATE POLICY "Users can view own tenant creative assets"
  ON public.ads_creative_assets FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant creative assets"
  ON public.ads_creative_assets FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant creative assets"
  ON public.ads_creative_assets FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

-- ads_tracking_health
CREATE POLICY "Users can view own tenant tracking health"
  ON public.ads_tracking_health FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant tracking health"
  ON public.ads_tracking_health FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- Trigger de updated_at para tabelas com updated_at
CREATE TRIGGER update_ads_autopilot_account_configs_updated_at
  BEFORE UPDATE ON public.ads_autopilot_account_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_autopilot_experiments_updated_at
  BEFORE UPDATE ON public.ads_autopilot_experiments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_creative_assets_updated_at
  BEFORE UPDATE ON public.ads_creative_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ads_account_configs_tenant_channel ON public.ads_autopilot_account_configs(tenant_id, channel);
CREATE INDEX idx_ads_insights_tenant_status ON public.ads_autopilot_insights(tenant_id, status);
CREATE INDEX idx_ads_experiments_tenant_status ON public.ads_autopilot_experiments(tenant_id, status);
CREATE INDEX idx_ads_creative_assets_tenant ON public.ads_creative_assets(tenant_id);
CREATE INDEX idx_ads_tracking_health_tenant ON public.ads_tracking_health(tenant_id, channel);
