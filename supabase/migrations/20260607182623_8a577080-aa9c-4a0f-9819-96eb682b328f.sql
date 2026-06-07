-- Subfase B — Tenant Memory Store (Ads Autopilot Etapa 7.mem)
-- Armazenamento de preferências aprendidas por tenant + plataforma de vendas + plataforma Ads.
-- Não influencia a IA nesta subfase. Writer virá na Subfase C.

CREATE TABLE public.ads_autopilot_tenant_memory (
  memory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sales_platform text NOT NULL,
  ads_platform text NOT NULL,
  memory_type text NOT NULL,
  scope text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,4) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count integer NOT NULL DEFAULT 0
    CHECK (evidence_count >= 0),
  status text NOT NULL DEFAULT 'provisional'
    CHECK (status IN ('provisional', 'active', 'archived')),
  source text NOT NULL DEFAULT 'system',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz,
  last_contradicted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT ads_autopilot_tenant_memory_unique_key
    UNIQUE (tenant_id, sales_platform, ads_platform, memory_type, scope, key)
);

CREATE INDEX idx_ads_autopilot_tenant_memory_tenant
  ON public.ads_autopilot_tenant_memory (tenant_id);
CREATE INDEX idx_ads_autopilot_tenant_memory_lookup
  ON public.ads_autopilot_tenant_memory (tenant_id, sales_platform, ads_platform, memory_type, status);
CREATE INDEX idx_ads_autopilot_tenant_memory_active
  ON public.ads_autopilot_tenant_memory (tenant_id, status)
  WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_autopilot_tenant_memory TO authenticated;
GRANT ALL ON public.ads_autopilot_tenant_memory TO service_role;

ALTER TABLE public.ads_autopilot_tenant_memory ENABLE ROW LEVEL SECURITY;

-- Isolamento estrito por tenant. Outro tenant não lê nem grava.
CREATE POLICY "Tenant members can read own memory"
  ON public.ads_autopilot_tenant_memory
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert own memory"
  ON public.ads_autopilot_tenant_memory
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update own memory"
  ON public.ads_autopilot_tenant_memory
  FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete own memory"
  ON public.ads_autopilot_tenant_memory
  FOR DELETE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role full access to tenant memory"
  ON public.ads_autopilot_tenant_memory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger de updated_at e coerência de archived_at/status
CREATE OR REPLACE FUNCTION public.ads_autopilot_tenant_memory_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'archived' AND NEW.archived_at IS NULL THEN
    NEW.archived_at := now();
  END IF;
  IF NEW.status <> 'archived' THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ads_autopilot_tenant_memory_touch
  BEFORE INSERT OR UPDATE ON public.ads_autopilot_tenant_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.ads_autopilot_tenant_memory_touch();

COMMENT ON TABLE public.ads_autopilot_tenant_memory IS
  'Etapa 7.mem Subfase B — Tenant Memory Store. Preferências aprendidas por tenant + plataforma de vendas + plataforma Ads. Não influencia a IA nesta subfase. Writer virá na Subfase C.';