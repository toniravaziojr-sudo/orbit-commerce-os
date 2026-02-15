
-- =============================================
-- FASE 10: TikTok Ads — Campanhas e Insights
-- =============================================

-- Tabela de campanhas do TikTok Ads
CREATE TABLE public.tiktok_ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_campaign_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CAMPAIGN_STATUS_NOT_DELETE',
  objective_type TEXT,
  budget_mode TEXT,
  budget_cents INTEGER,
  bid_type TEXT,
  optimize_goal TEXT,
  start_time TEXT,
  end_time TEXT,
  campaign_type TEXT,
  special_industries TEXT[],
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tiktok_campaign_id)
);

ALTER TABLE public.tiktok_ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tiktok_ad_campaigns"
  ON public.tiktok_ad_campaigns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = tiktok_ad_campaigns.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = tiktok_ad_campaigns.tenant_id
    )
  );

-- Tabela de insights/métricas do TikTok Ads
CREATE TABLE public.tiktok_ad_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.tiktok_ad_campaigns(id) ON DELETE SET NULL,
  tiktok_campaign_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend_cents INTEGER DEFAULT 0,
  reach BIGINT DEFAULT 0,
  cpc_cents INTEGER DEFAULT 0,
  cpm_cents INTEGER DEFAULT 0,
  ctr NUMERIC(8,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value_cents INTEGER DEFAULT 0,
  roas NUMERIC(10,4) DEFAULT 0,
  frequency NUMERIC(8,4) DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  video_watched_2s INTEGER DEFAULT 0,
  video_watched_6s INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tiktok_campaign_id, date_start)
);

ALTER TABLE public.tiktok_ad_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tiktok_ad_insights"
  ON public.tiktok_ad_insights
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = tiktok_ad_insights.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.tenant_id = tiktok_ad_insights.tenant_id
    )
  );

-- Trigger para updated_at em campanhas
CREATE TRIGGER update_tiktok_ad_campaigns_updated_at
  BEFORE UPDATE ON public.tiktok_ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_tiktok_ad_campaigns_tenant ON public.tiktok_ad_campaigns(tenant_id);
CREATE INDEX idx_tiktok_ad_insights_tenant_date ON public.tiktok_ad_insights(tenant_id, date_start DESC);
CREATE INDEX idx_tiktok_ad_insights_campaign ON public.tiktok_ad_insights(campaign_id);
