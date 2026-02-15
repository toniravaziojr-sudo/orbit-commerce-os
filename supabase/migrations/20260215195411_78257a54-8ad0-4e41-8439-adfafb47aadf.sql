
-- Table for individual ads (level below ad sets)
CREATE TABLE public.meta_ad_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_ad_id TEXT NOT NULL,
  meta_adset_id TEXT NOT NULL,
  meta_campaign_id TEXT NOT NULL,
  adset_id UUID REFERENCES public.meta_ad_adsets(id) ON DELETE SET NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  creative_id TEXT,
  tracking_specs JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, meta_ad_id)
);

-- Enable RLS
ALTER TABLE public.meta_ad_ads ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other meta_ad_* tables)
CREATE POLICY "Users can view their tenant ads"
  ON public.meta_ad_ads FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant ads"
  ON public.meta_ad_ads FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant ads"
  ON public.meta_ad_ads FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their tenant ads"
  ON public.meta_ad_ads FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Service role policy for edge functions
CREATE POLICY "Service role full access on meta_ad_ads"
  ON public.meta_ad_ads FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_meta_ad_ads_tenant ON public.meta_ad_ads(tenant_id);
CREATE INDEX idx_meta_ad_ads_adset ON public.meta_ad_ads(meta_adset_id);
CREATE INDEX idx_meta_ad_ads_campaign ON public.meta_ad_ads(meta_campaign_id);
