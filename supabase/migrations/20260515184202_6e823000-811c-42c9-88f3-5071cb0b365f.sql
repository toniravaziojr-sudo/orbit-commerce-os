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
      WHERE marketplace = 'mercadolivre'
        AND is_active = true
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'shopee' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.marketplace_connections
      WHERE marketplace = 'shopee'
        AND is_active = true
        AND (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'tiktok_shop' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.tiktok_shop_connections
      WHERE (last_sync_at IS NULL OR last_sync_at >= v_cutoff);

    WHEN 'whatsapp_meta' THEN
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.whatsapp_configs
      WHERE provider = 'meta'
        AND is_enabled = true
        AND access_token IS NOT NULL
        AND phone_number_id IS NOT NULL;

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
      SELECT COUNT(DISTINCT tenant_id) INTO v_count
      FROM public.ads_autopilot_configs
      WHERE is_enabled = true;

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
      WHERE refresh_token IS NOT NULL
        AND is_active = true;

    ELSE
      v_count := 0;
  END CASE;

  RETURN COALESCE(v_count, 0);
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN 0;
END;
$function$;