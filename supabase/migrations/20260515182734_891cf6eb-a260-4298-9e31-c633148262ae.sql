
-- ============================================================
-- ONDA A — Registro Central de Recursos em Uso
-- ============================================================

-- 1) Tabela principal: registro por módulo
CREATE TABLE IF NOT EXISTS public.system_resource_usage (
  module_key TEXT PRIMARY KEY,
  module_name TEXT NOT NULL,
  module_group TEXT NOT NULL,
  active_tenant_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'dormant' CHECK (status IN ('active', 'dormant')),
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_activation_at TIMESTAMPTZ,
  last_event_tenant_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_resource_usage ENABLE ROW LEVEL SECURITY;

-- Apenas super-admin lê o registro
CREATE POLICY "platform admins can view resource usage"
  ON public.system_resource_usage
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

-- Bloqueio total de escrita do client (só service_role)
CREATE POLICY "no client writes on resource usage"
  ON public.system_resource_usage
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 2) Tabela de auditoria de execuções puladas
CREATE TABLE IF NOT EXISTS public.system_resource_skip_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  cron_job_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  active_tenant_count INTEGER NOT NULL DEFAULT 0,
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skip_log_module_time
  ON public.system_resource_skip_log (module_key, skipped_at DESC);

CREATE INDEX IF NOT EXISTS idx_skip_log_time
  ON public.system_resource_skip_log (skipped_at DESC);

ALTER TABLE public.system_resource_skip_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins can view skip log"
  ON public.system_resource_skip_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "no client writes on skip log"
  ON public.system_resource_skip_log
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 3) Seed: registra os módulos que vamos monitorar
INSERT INTO public.system_resource_usage (module_key, module_name, module_group)
VALUES
  ('meta_ads',          'Meta Ads',                'Marketing'),
  ('google_ads',        'Google Ads',              'Marketing'),
  ('mercado_livre',     'Mercado Livre',           'Marketplaces'),
  ('shopee',            'Shopee',                  'Marketplaces'),
  ('tiktok_shop',       'TikTok Shop',             'Marketplaces'),
  ('whatsapp_meta',     'WhatsApp Meta',           'Atendimento & IA'),
  ('catalogo_meta',     'Catálogo Meta',           'Marketing'),
  ('ai_support',        'IA de Atendimento',       'Atendimento & IA'),
  ('ai_traffic_manager','IA Gestor de Tráfego',    'Marketing'),
  ('email_marketing',   'E-mail Marketing',        'Marketing'),
  ('fiscal',            'Fiscal (NFe)',            'Logística & Fiscal'),
  ('youtube_publishing','YouTube Publishing',      'Marketing')
ON CONFLICT (module_key) DO NOTHING;

-- 4) Função interna: detecta atividade real por módulo
-- Retorna a contagem de tenants ativos para um módulo específico
CREATE OR REPLACE FUNCTION public.count_active_tenants_for_module(p_module_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
BEGIN
  CASE p_module_key
    WHEN 'meta_ads' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.tenant_meta_integrations
      WHERE access_token IS NOT NULL
        AND selected_assets IS NOT NULL
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'google_ads' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.google_ads_connections
      WHERE refresh_token IS NOT NULL
        AND customer_id IS NOT NULL
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'mercado_livre' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.marketplace_connections
      WHERE provider = 'mercado_livre'
        AND status = 'connected'
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'shopee' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.marketplace_connections
      WHERE provider = 'shopee'
        AND status = 'connected'
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'tiktok_shop' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.marketplace_connections
      WHERE provider = 'tiktok_shop'
        AND status = 'connected'
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'whatsapp_meta' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.whatsapp_configs
      WHERE phone_number_id IS NOT NULL
        AND access_token IS NOT NULL
        AND status IN ('connected', 'active');

    WHEN 'catalogo_meta' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.tenant_meta_integrations
      WHERE selected_assets ? 'catalog_id'
        AND access_token IS NOT NULL;

    WHEN 'ai_support' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.ai_support_config
      WHERE enabled = true;

    WHEN 'ai_traffic_manager' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.ads_global_config
      WHERE ai_traffic_manager_enabled = true;

    WHEN 'email_marketing' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM (
        SELECT tenant_id FROM public.email_marketing_campaigns
          WHERE status IN ('scheduled','sending','sent')
            AND created_at >= v_cutoff
        UNION
        SELECT tenant_id FROM public.email_marketing_leads
          WHERE created_at >= v_cutoff
      ) t;

    WHEN 'fiscal' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.fiscal_certificates
      WHERE expires_at > now();

    WHEN 'youtube_publishing' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.youtube_connections
      WHERE refresh_token IS NOT NULL;

    ELSE
      v_count := 0;
  END CASE;

  RETURN COALESCE(v_count, 0);
EXCEPTION WHEN undefined_table OR undefined_column THEN
  -- Se a tabela/coluna não existir ainda, considera 0 (não quebra)
  RETURN 0;
END;
$$;

-- 5) Função pública: cron consulta antes de rodar
-- Retorna TRUE se o módulo tem pelo menos 1 tenant ativo
CREATE OR REPLACE FUNCTION public.is_module_active(p_module_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_status TEXT;
BEGIN
  SELECT active_tenant_count, status
    INTO v_count, v_status
  FROM public.system_resource_usage
  WHERE module_key = p_module_key;

  -- Se módulo não está cadastrado, fail-safe: deixa rodar
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  RETURN v_status = 'active' AND COALESCE(v_count, 0) > 0;
END;
$$;

-- 6) Função: registra execução pulada (auditoria)
CREATE OR REPLACE FUNCTION public.log_skipped_cron_execution(
  p_module_key TEXT,
  p_cron_job_name TEXT,
  p_reason TEXT DEFAULT 'no_active_tenants'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  SELECT active_tenant_count INTO v_count
  FROM public.system_resource_usage
  WHERE module_key = p_module_key;

  INSERT INTO public.system_resource_skip_log (module_key, cron_job_name, reason, active_tenant_count)
  VALUES (p_module_key, p_cron_job_name, p_reason, COALESCE(v_count, 0));
END;
$$;

-- 7) Função: ativação imediata por evento
-- Chamada quando um tenant conecta um recurso (não espera cron)
CREATE OR REPLACE FUNCTION public.mark_module_active_by_event(
  p_module_key TEXT,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.system_resource_usage
  SET
    status = 'active',
    active_tenant_count = GREATEST(active_tenant_count, 1),
    last_event_activation_at = now(),
    last_event_tenant_id = p_tenant_id,
    updated_at = now()
  WHERE module_key = p_module_key;
END;
$$;

-- 8) Função principal: refresh completo (rodada pelo cron diário)
CREATE OR REPLACE FUNCTION public.refresh_system_resource_usage()
RETURNS TABLE(module_key TEXT, active_count INTEGER, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_count INTEGER;
  v_status TEXT;
BEGIN
  FOR r IN SELECT sru.module_key FROM public.system_resource_usage sru LOOP
    v_count := public.count_active_tenants_for_module(r.module_key);
    v_status := CASE WHEN v_count > 0 THEN 'active' ELSE 'dormant' END;

    UPDATE public.system_resource_usage
    SET
      active_tenant_count = v_count,
      status = v_status,
      last_refreshed_at = now(),
      updated_at = now()
    WHERE system_resource_usage.module_key = r.module_key;

    module_key := r.module_key;
    active_count := v_count;
    status := v_status;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- 9) Trigger de updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resource_usage_touch ON public.system_resource_usage;
CREATE TRIGGER trg_resource_usage_touch
  BEFORE UPDATE ON public.system_resource_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- 10) Refresh inicial (popula contagens já)
SELECT public.refresh_system_resource_usage();
