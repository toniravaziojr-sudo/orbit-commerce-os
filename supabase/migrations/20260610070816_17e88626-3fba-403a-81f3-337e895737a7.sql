
CREATE TABLE public.ads_ai_analysis_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'meta',
  ad_account_id TEXT,
  scope TEXT NOT NULL DEFAULT 'account' CHECK (scope IN ('account','global')),
  trigger TEXT NOT NULL CHECK (trigger IN ('activation_initial','manual')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  input_config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  account_snapshot_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagnosis_summary TEXT,
  strategy_summary TEXT,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_action_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_id UUID,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ads_ai_analysis_runs_tenant_idx ON public.ads_ai_analysis_runs(tenant_id, created_at DESC);
CREATE INDEX ads_ai_analysis_runs_scope_idx ON public.ads_ai_analysis_runs(tenant_id, platform, ad_account_id, scope, status);
CREATE UNIQUE INDEX ads_ai_analysis_runs_single_running_idx
  ON public.ads_ai_analysis_runs(tenant_id, platform, COALESCE(ad_account_id,'__global__'), scope)
  WHERE status IN ('queued','running');

GRANT SELECT, INSERT, UPDATE ON public.ads_ai_analysis_runs TO authenticated;
GRANT ALL ON public.ads_ai_analysis_runs TO service_role;

ALTER TABLE public.ads_ai_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can read analysis runs"
  ON public.ads_ai_analysis_runs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can insert analysis runs"
  ON public.ads_ai_analysis_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "tenant members can update analysis runs"
  ON public.ads_ai_analysis_runs FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER ads_ai_analysis_runs_set_updated_at
  BEFORE UPDATE ON public.ads_ai_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
