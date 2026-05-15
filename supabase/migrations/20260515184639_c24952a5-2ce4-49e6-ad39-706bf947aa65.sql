-- Trigger genérico: dispara mark_module_active_by_event quando recurso é conectado.
CREATE OR REPLACE FUNCTION public.tg_mark_module_active_generic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_module text := TG_ARGV[0];
BEGIN
  PERFORM public.mark_module_active_by_event(v_module);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- nunca quebra o INSERT/UPDATE de origem
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_mark_module_active_generic() FROM PUBLIC, anon, authenticated;

-- whatsapp_configs (Meta)
DROP TRIGGER IF EXISTS trg_resource_active_whatsapp ON public.whatsapp_configs;
CREATE TRIGGER trg_resource_active_whatsapp
AFTER INSERT OR UPDATE OF access_token, phone_number_id, is_enabled ON public.whatsapp_configs
FOR EACH ROW WHEN (NEW.provider = 'meta' AND NEW.is_enabled = true AND NEW.access_token IS NOT NULL)
EXECUTE FUNCTION public.tg_mark_module_active_generic('whatsapp_meta');

-- tenant_meta_integrations (Meta Ads + Catálogo)
DROP TRIGGER IF EXISTS trg_resource_active_meta_ads ON public.tenant_meta_integrations;
CREATE TRIGGER trg_resource_active_meta_ads
AFTER INSERT OR UPDATE OF auth_grant_id, status, selected_assets ON public.tenant_meta_integrations
FOR EACH ROW WHEN (NEW.auth_grant_id IS NOT NULL AND NEW.status IN ('connected','active'))
EXECUTE FUNCTION public.tg_mark_module_active_generic('meta_ads');

DROP TRIGGER IF EXISTS trg_resource_active_catalogo_meta ON public.tenant_meta_integrations;
CREATE TRIGGER trg_resource_active_catalogo_meta
AFTER INSERT OR UPDATE OF selected_assets ON public.tenant_meta_integrations
FOR EACH ROW WHEN (NEW.selected_assets ? 'catalog_id')
EXECUTE FUNCTION public.tg_mark_module_active_generic('catalogo_meta');

-- google_connections (Google Ads)
DROP TRIGGER IF EXISTS trg_resource_active_google_ads ON public.google_connections;
CREATE TRIGGER trg_resource_active_google_ads
AFTER INSERT OR UPDATE OF refresh_token, is_active, granted_scopes ON public.google_connections
FOR EACH ROW WHEN (NEW.refresh_token IS NOT NULL AND NEW.is_active = true)
EXECUTE FUNCTION public.tg_mark_module_active_generic('google_ads');

-- marketplace_connections (Mercado Livre / Shopee)
CREATE OR REPLACE FUNCTION public.tg_mark_marketplace_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = true THEN
    IF NEW.marketplace = 'mercadolivre' THEN
      PERFORM public.mark_module_active_by_event('mercado_livre');
    ELSIF NEW.marketplace = 'shopee' THEN
      PERFORM public.mark_module_active_by_event('shopee');
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_mark_marketplace_active() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resource_active_marketplace ON public.marketplace_connections;
CREATE TRIGGER trg_resource_active_marketplace
AFTER INSERT OR UPDATE OF is_active, marketplace ON public.marketplace_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_marketplace_active();

-- tiktok_shop_connections
DROP TRIGGER IF EXISTS trg_resource_active_tiktok ON public.tiktok_shop_connections;
CREATE TRIGGER trg_resource_active_tiktok
AFTER INSERT OR UPDATE ON public.tiktok_shop_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_module_active_generic('tiktok_shop');

-- ai_support_config
DROP TRIGGER IF EXISTS trg_resource_active_ai_support ON public.ai_support_config;
CREATE TRIGGER trg_resource_active_ai_support
AFTER INSERT OR UPDATE OF is_enabled ON public.ai_support_config
FOR EACH ROW WHEN (NEW.is_enabled = true)
EXECUTE FUNCTION public.tg_mark_module_active_generic('ai_support');

-- ads_autopilot_configs (IA Gestor de Tráfego)
DROP TRIGGER IF EXISTS trg_resource_active_ai_traffic ON public.ads_autopilot_configs;
CREATE TRIGGER trg_resource_active_ai_traffic
AFTER INSERT OR UPDATE OF is_enabled ON public.ads_autopilot_configs
FOR EACH ROW WHEN (NEW.is_enabled = true)
EXECUTE FUNCTION public.tg_mark_module_active_generic('ai_traffic_manager');

-- fiscal_settings (NFe)
DROP TRIGGER IF EXISTS trg_resource_active_fiscal ON public.fiscal_settings;
CREATE TRIGGER trg_resource_active_fiscal
AFTER INSERT OR UPDATE OF is_configured, certificado_valido_ate ON public.fiscal_settings
FOR EACH ROW WHEN (NEW.is_configured = true AND NEW.certificado_valido_ate IS NOT NULL)
EXECUTE FUNCTION public.tg_mark_module_active_generic('fiscal');

-- youtube_connections
DROP TRIGGER IF EXISTS trg_resource_active_youtube ON public.youtube_connections;
CREATE TRIGGER trg_resource_active_youtube
AFTER INSERT OR UPDATE OF refresh_token, is_active ON public.youtube_connections
FOR EACH ROW WHEN (NEW.refresh_token IS NOT NULL AND NEW.is_active = true)
EXECUTE FUNCTION public.tg_mark_module_active_generic('youtube_publishing');

-- email_marketing: ativa quando lojista cria campanha ou cadastra inscrito
DROP TRIGGER IF EXISTS trg_resource_active_email_campaign ON public.email_marketing_campaigns;
CREATE TRIGGER trg_resource_active_email_campaign
AFTER INSERT ON public.email_marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_module_active_generic('email_marketing');

DROP TRIGGER IF EXISTS trg_resource_active_email_subscriber ON public.email_marketing_subscribers;
CREATE TRIGGER trg_resource_active_email_subscriber
AFTER INSERT ON public.email_marketing_subscribers
FOR EACH ROW EXECUTE FUNCTION public.tg_mark_module_active_generic('email_marketing');