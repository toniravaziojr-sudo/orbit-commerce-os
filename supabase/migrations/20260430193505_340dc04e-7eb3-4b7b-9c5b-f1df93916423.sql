
CREATE TABLE IF NOT EXISTS public.oauth_state_store (
  state_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON public.oauth_state_store(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_state_tenant ON public.oauth_state_store(tenant_id, provider);

ALTER TABLE public.oauth_state_store ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa (mediado por edge functions)
DROP POLICY IF EXISTS "oauth_state_no_anon" ON public.oauth_state_store;
CREATE POLICY "oauth_state_no_anon" ON public.oauth_state_store
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "oauth_state_no_authenticated" ON public.oauth_state_store;
CREATE POLICY "oauth_state_no_authenticated" ON public.oauth_state_store
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
