CREATE TABLE public.ai_prompt_conflict_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global','account')),
  channel text,
  ad_account_id text,
  prompt_hash text NOT NULL,
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ignored_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_prompt_conflict_cache_unique_key
  ON public.ai_prompt_conflict_cache (tenant_id, scope, COALESCE(channel,''), COALESCE(ad_account_id,''), prompt_hash);

CREATE INDEX ai_prompt_conflict_cache_tenant_idx
  ON public.ai_prompt_conflict_cache (tenant_id, scope, channel, ad_account_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_conflict_cache TO authenticated;
GRANT ALL ON public.ai_prompt_conflict_cache TO service_role;

ALTER TABLE public.ai_prompt_conflict_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read their prompt alerts"
  ON public.ai_prompt_conflict_cache FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members update their prompt alerts"
  ON public.ai_prompt_conflict_cache FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER ai_prompt_conflict_cache_updated_at
  BEFORE UPDATE ON public.ai_prompt_conflict_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();