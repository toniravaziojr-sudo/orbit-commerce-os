
-- =============================================
-- Meta Ad Sets (Conjuntos de Anúncios)
-- Cache local dos ad sets da Meta Ads API
-- =============================================

CREATE TABLE public.meta_ad_adsets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  meta_adset_id TEXT NOT NULL,
  meta_campaign_id TEXT NOT NULL,
  campaign_id UUID REFERENCES public.meta_ad_campaigns(id) ON DELETE SET NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  optimization_goal TEXT,
  billing_event TEXT,
  bid_amount_cents INTEGER,
  daily_budget_cents INTEGER,
  lifetime_budget_cents INTEGER,
  targeting JSONB DEFAULT '{}',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, meta_adset_id)
);

-- Enable RLS
ALTER TABLE public.meta_ad_adsets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their tenant ad sets"
ON public.meta_ad_adsets FOR SELECT
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert their tenant ad sets"
ON public.meta_ad_adsets FOR INSERT
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update their tenant ad sets"
ON public.meta_ad_adsets FOR UPDATE
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete their tenant ad sets"
ON public.meta_ad_adsets FOR DELETE
USING (public.user_has_tenant_access(tenant_id));

-- Service role policy (for edge functions)
CREATE POLICY "Service role full access on meta_ad_adsets"
ON public.meta_ad_adsets FOR ALL
USING (true)
WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER update_meta_ad_adsets_updated_at
BEFORE UPDATE ON public.meta_ad_adsets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for campaign lookup
CREATE INDEX idx_meta_ad_adsets_campaign ON public.meta_ad_adsets(tenant_id, meta_campaign_id);
CREATE INDEX idx_meta_ad_adsets_account ON public.meta_ad_adsets(tenant_id, ad_account_id);
