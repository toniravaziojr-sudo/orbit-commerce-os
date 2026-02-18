
-- v5.11.2: Pipeline artifacts table for process-oriented autopilot
CREATE TABLE IF NOT EXISTS public.ads_autopilot_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  ad_account_id TEXT,
  session_id TEXT,
  strategy_run_id TEXT,
  campaign_key TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('strategy','copy','creative_prompt','campaign_plan','user_command')),
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_run ON public.ads_autopilot_artifacts(tenant_id, strategy_run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_key ON public.ads_autopilot_artifacts(tenant_id, campaign_key);
CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_type ON public.ads_autopilot_artifacts(tenant_id, artifact_type);

-- Unique constraint for UPSERT by tenant + campaign_key + artifact_type
CREATE UNIQUE INDEX IF NOT EXISTS uq_artifacts_tenant_key_type ON public.ads_autopilot_artifacts(tenant_id, campaign_key, artifact_type);

-- Enable RLS
ALTER TABLE public.ads_autopilot_artifacts ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions use service_role)
CREATE POLICY "Service role full access on artifacts"
  ON public.ads_autopilot_artifacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_ads_autopilot_artifacts_updated_at
  BEFORE UPDATE ON public.ads_autopilot_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
