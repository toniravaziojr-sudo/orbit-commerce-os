
CREATE TABLE public.ads_ai_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  channel TEXT NOT NULL,
  ad_account_id TEXT,
  campaign_ref TEXT,
  creative_ref TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'informativo' CHECK (severity IN ('informativo','atencao','urgente')),
  trend TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','seen','dismissed','converted')),
  converted_to_action_id UUID,
  first_signal_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_signal_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signal_count INTEGER NOT NULL DEFAULT 1,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_ai_warnings_tenant_status ON public.ads_ai_warnings(tenant_id, status, last_signal_at DESC);
CREATE INDEX idx_ads_ai_warnings_account ON public.ads_ai_warnings(tenant_id, channel, ad_account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_ai_warnings TO authenticated;
GRANT ALL ON public.ads_ai_warnings TO service_role;

ALTER TABLE public.ads_ai_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tenant ads warnings"
  ON public.ads_ai_warnings FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users update own tenant ads warnings"
  ON public.ads_ai_warnings FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users delete own tenant ads warnings"
  ON public.ads_ai_warnings FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role manages ads warnings"
  ON public.ads_ai_warnings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ads_ai_warnings_updated_at
  BEFORE UPDATE ON public.ads_ai_warnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.ads_autopilot_account_configs acc
SET user_instructions = g.user_instructions,
    updated_at = now()
FROM public.ads_autopilot_configs g
WHERE acc.tenant_id = g.tenant_id
  AND g.channel = 'global'
  AND COALESCE(NULLIF(TRIM(acc.user_instructions), ''), '') = ''
  AND COALESCE(NULLIF(TRIM(g.user_instructions), ''), '') <> '';
