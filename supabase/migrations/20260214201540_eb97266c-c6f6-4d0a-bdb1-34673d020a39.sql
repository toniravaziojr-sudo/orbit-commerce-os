
-- =============================================
-- Fase 3: Meta Ads Manager — Tabelas
-- =============================================

-- Campanhas sincronizadas da Meta Ads
CREATE TABLE public.meta_ad_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  objective TEXT,
  buying_type TEXT DEFAULT 'AUCTION',
  daily_budget_cents BIGINT,
  lifetime_budget_cents BIGINT,
  bid_strategy TEXT,
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  special_ad_categories TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, meta_campaign_id)
);

-- Insights (métricas) de campanhas — cache local
CREATE TABLE public.meta_ad_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.meta_ad_campaigns(id) ON DELETE CASCADE,
  meta_campaign_id TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend_cents BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  cpc_cents BIGINT DEFAULT 0,
  cpm_cents BIGINT DEFAULT 0,
  ctr NUMERIC(10,4) DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  conversion_value_cents BIGINT DEFAULT 0,
  cost_per_conversion_cents BIGINT DEFAULT 0,
  roas NUMERIC(10,4) DEFAULT 0,
  frequency NUMERIC(10,4) DEFAULT 0,
  actions JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, meta_campaign_id, date_start, date_stop)
);

-- Públicos salvos (audiences)
CREATE TABLE public.meta_ad_audiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_audience_id TEXT,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'custom',
  subtype TEXT,
  approximate_count BIGINT,
  description TEXT,
  rule JSONB,
  lookalike_spec JSONB,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, meta_audience_id)
);

-- Criativos (ad creatives)
CREATE TABLE public.meta_ad_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_creative_id TEXT,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  body TEXT,
  call_to_action_type TEXT,
  link_url TEXT,
  image_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  object_story_spec JSONB,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, meta_creative_id)
);

-- Enable RLS
ALTER TABLE public.meta_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_creatives ENABLE ROW LEVEL SECURITY;

-- RLS policies (tenant-scoped via user_roles)
CREATE POLICY "Users can view their tenant campaigns" ON public.meta_ad_campaigns
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can manage their tenant campaigns" ON public.meta_ad_campaigns
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can view their tenant insights" ON public.meta_ad_insights
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can manage their tenant insights" ON public.meta_ad_insights
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can view their tenant audiences" ON public.meta_ad_audiences
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can manage their tenant audiences" ON public.meta_ad_audiences
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can view their tenant creatives" ON public.meta_ad_creatives
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can manage their tenant creatives" ON public.meta_ad_creatives
  FOR ALL USING (public.user_has_tenant_access(tenant_id));

-- Triggers for updated_at
CREATE TRIGGER update_meta_ad_campaigns_updated_at
  BEFORE UPDATE ON public.meta_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ad_audiences_updated_at
  BEFORE UPDATE ON public.meta_ad_audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_ad_creatives_updated_at
  BEFORE UPDATE ON public.meta_ad_creatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_meta_ad_campaigns_tenant ON public.meta_ad_campaigns(tenant_id);
CREATE INDEX idx_meta_ad_campaigns_status ON public.meta_ad_campaigns(tenant_id, status);
CREATE INDEX idx_meta_ad_insights_campaign ON public.meta_ad_insights(campaign_id);
CREATE INDEX idx_meta_ad_insights_date ON public.meta_ad_insights(tenant_id, date_start, date_stop);
CREATE INDEX idx_meta_ad_audiences_tenant ON public.meta_ad_audiences(tenant_id);
CREATE INDEX idx_meta_ad_creatives_tenant ON public.meta_ad_creatives(tenant_id);
