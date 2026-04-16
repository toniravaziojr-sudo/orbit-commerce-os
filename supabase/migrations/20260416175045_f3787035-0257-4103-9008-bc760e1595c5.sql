CREATE TABLE IF NOT EXISTS public.ad_insights_sync_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta','google','tiktok')),
  ad_account_id text,
  first_day_synced date,
  last_day_synced date,
  last_sync_at timestamptz,
  last_sync_kind text CHECK (last_sync_kind IN ('daily','weekly','on_connect','on_demand','manual')),
  last_sync_status text DEFAULT 'pending' CHECK (last_sync_status IN ('pending','running','success','error')),
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_insights_sync_coverage_tenant ON public.ad_insights_sync_coverage(tenant_id, platform);

ALTER TABLE public.ad_insights_sync_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read coverage" ON public.ad_insights_sync_coverage
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages coverage" ON public.ad_insights_sync_coverage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_ad_insights_sync_coverage()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_coverage ON public.ad_insights_sync_coverage;
CREATE TRIGGER trg_touch_coverage BEFORE UPDATE ON public.ad_insights_sync_coverage
  FOR EACH ROW EXECUTE FUNCTION public.touch_ad_insights_sync_coverage();

COMMENT ON TABLE public.ad_insights_sync_coverage IS 'Rastreamento de cobertura de sincronização de insights de anúncios por tenant/plataforma. Permite detectar lacunas e disparar backfill sob demanda.';