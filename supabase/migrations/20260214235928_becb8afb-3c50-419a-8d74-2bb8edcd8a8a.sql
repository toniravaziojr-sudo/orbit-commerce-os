
-- =============================================
-- Fase 4: Google Ads Manager — Tabelas de cache
-- =============================================

-- Tabela de campanhas Google Ads (cache local)
CREATE TABLE public.google_ad_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  google_campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  campaign_type TEXT,
  bidding_strategy_type TEXT,
  budget_amount_micros BIGINT,
  budget_type TEXT DEFAULT 'DAILY',
  start_date TEXT,
  end_date TEXT,
  target_cpa_micros BIGINT,
  target_roas NUMERIC,
  optimization_score NUMERIC,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_ad_campaigns UNIQUE (tenant_id, google_campaign_id)
);

-- Tabela de insights/métricas Google Ads (cache diário)
CREATE TABLE public.google_ad_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  google_campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  conversions_value NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  average_cpc_micros BIGINT DEFAULT 0,
  average_cpm_micros BIGINT DEFAULT 0,
  interaction_rate NUMERIC DEFAULT 0,
  video_views BIGINT DEFAULT 0,
  view_rate NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_ad_insights UNIQUE (tenant_id, google_campaign_id, date)
);

-- Tabela de audiências Google Ads (cache local)
CREATE TABLE public.google_ad_audiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  google_audience_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  audience_type TEXT DEFAULT 'USER_LIST',
  description TEXT,
  membership_status TEXT,
  size_estimate BIGINT,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_ad_audiences UNIQUE (tenant_id, google_audience_id)
);

-- Índices
CREATE INDEX idx_google_ad_campaigns_tenant ON public.google_ad_campaigns(tenant_id);
CREATE INDEX idx_google_ad_insights_tenant_date ON public.google_ad_insights(tenant_id, date DESC);
CREATE INDEX idx_google_ad_audiences_tenant ON public.google_ad_audiences(tenant_id);

-- RLS
ALTER TABLE public.google_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ad_audiences ENABLE ROW LEVEL SECURITY;

-- Policies: google_ad_campaigns
CREATE POLICY "Tenant members can view google ad campaigns"
  ON public.google_ad_campaigns FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert google ad campaigns"
  ON public.google_ad_campaigns FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update google ad campaigns"
  ON public.google_ad_campaigns FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete google ad campaigns"
  ON public.google_ad_campaigns FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Policies: google_ad_insights
CREATE POLICY "Tenant members can view google ad insights"
  ON public.google_ad_insights FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert google ad insights"
  ON public.google_ad_insights FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update google ad insights"
  ON public.google_ad_insights FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete google ad insights"
  ON public.google_ad_insights FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Policies: google_ad_audiences
CREATE POLICY "Tenant members can view google ad audiences"
  ON public.google_ad_audiences FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert google ad audiences"
  ON public.google_ad_audiences FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update google ad audiences"
  ON public.google_ad_audiences FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete google ad audiences"
  ON public.google_ad_audiences FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Triggers updated_at
CREATE TRIGGER update_google_ad_campaigns_updated_at
  BEFORE UPDATE ON public.google_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_ad_audiences_updated_at
  BEFORE UPDATE ON public.google_ad_audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
