
-- Estende o gate do módulo ai_traffic_manager para reconhecer ativação granular
-- por conta de anúncio (ads_autopilot_account_configs), mantendo compatibilidade
-- com a ativação por canal (ads_autopilot_configs).
CREATE OR REPLACE FUNCTION public.count_active_tenants_for_module(p_module_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
BEGIN
  CASE p_module_key
    WHEN 'meta_ads' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.tenant_meta_integrations
      WHERE auth_grant_id IS NOT NULL
        AND status IN ('connected','active')
        AND selected_assets IS NOT NULL
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'google_ads' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.google_connections
      WHERE refresh_token IS NOT NULL
        AND is_active = true
        AND (granted_scopes::text ILIKE '%adwords%' OR scope_packs::text ILIKE '%ads%')
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'mercado_livre' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.marketplace_connections
      WHERE marketplace = 'mercadolivre' AND is_active = true
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'shopee' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.marketplace_connections
      WHERE marketplace = 'shopee' AND is_active = true
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'tiktok_shop' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.tiktok_shop_connections
      WHERE (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'whatsapp_meta' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.whatsapp_configs
      WHERE provider = 'meta' AND is_enabled = true
        AND access_token IS NOT NULL AND phone_number_id IS NOT NULL;

    WHEN 'catalogo_meta' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.tenant_meta_integrations
      WHERE selected_assets ? 'catalog_id'
        AND auth_grant_id IS NOT NULL
        AND status IN ('connected','active');

    WHEN 'ai_support' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.ai_support_config
      WHERE is_enabled = true;

    WHEN 'ai_traffic_manager' THEN
      -- Caminho legado (ativação por canal) UNIÃO caminho granular (por conta).
      -- Conta como ativo se houver QUALQUER um dos dois.
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM (
        SELECT tenant_id FROM public.ads_autopilot_configs
          WHERE is_enabled = true
        UNION
        SELECT tenant_id FROM public.ads_autopilot_account_configs
          WHERE is_ai_enabled = true
            AND COALESCE(kill_switch, false) = false
            AND COALESCE(autonomy_mode, 'technical_only') <> 'off'
      ) t;

    WHEN 'email_marketing' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM (
        SELECT tenant_id FROM public.email_marketing_campaigns
          WHERE status IN ('scheduled','sending','sent')
            AND created_at >= v_cutoff
        UNION
        SELECT tenant_id FROM public.email_marketing_subscribers
          WHERE created_at >= v_cutoff
      ) t;

    WHEN 'fiscal' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.fiscal_settings
      WHERE is_configured = true
        AND certificado_valido_ate IS NOT NULL
        AND certificado_valido_ate > now();

    WHEN 'youtube_publishing' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.youtube_connections
      WHERE refresh_token IS NOT NULL AND is_active = true;

    WHEN 'shipping_gateway' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.shipping_providers
      WHERE is_enabled = true AND provider_kind = 'gateway';

    ELSE
      v_count := 0;
  END CASE;

  RETURN COALESCE(v_count, 0);
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN 0;
END;
$function$;

-- Ativação imediata por evento quando o piloto granular é ligado em uma conta.
CREATE OR REPLACE FUNCTION public.trg_mark_ai_traffic_manager_active_from_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_ai_enabled = true
     AND COALESCE(NEW.kill_switch, false) = false
     AND COALESCE(NEW.autonomy_mode, 'technical_only') <> 'off' THEN
    PERFORM public.mark_module_active_by_event('ai_traffic_manager');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_config_mark_ai_traffic_manager_active
  ON public.ads_autopilot_account_configs;

CREATE TRIGGER trg_account_config_mark_ai_traffic_manager_active
AFTER INSERT OR UPDATE OF is_ai_enabled, kill_switch, autonomy_mode
ON public.ads_autopilot_account_configs
FOR EACH ROW
EXECUTE FUNCTION public.trg_mark_ai_traffic_manager_active_from_account();

-- Refresh imediato do registro do recurso.
SELECT public.refresh_system_resource_usage();
