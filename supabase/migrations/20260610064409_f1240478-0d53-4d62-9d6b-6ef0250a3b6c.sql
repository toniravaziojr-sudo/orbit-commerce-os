
-- Onda D — Configuração de Criação Meta (persistida)
-- Fonte de verdade operacional usada pelo Strategist para preencher
-- propostas v2 de campanhas Meta Ads com defaults reais da conta.

CREATE TABLE public.ads_meta_production_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,

  -- Identidade
  facebook_page_id text,
  instagram_actor_id text,

  -- Mensuração
  pixel_id text,
  default_conversion_event text,
  attribution_window text,

  -- Campanha (defaults)
  default_objective text NOT NULL DEFAULT 'sales',
  default_buying_type text NOT NULL DEFAULT 'AUCTION',
  default_budget_type text NOT NULL DEFAULT 'daily',
  default_daily_budget_cents integer,
  default_planned_status text NOT NULL DEFAULT 'PAUSED',

  -- Conjunto (defaults)
  default_country text NOT NULL DEFAULT 'BR',
  default_language text NOT NULL DEFAULT 'pt_BR',
  default_age_min integer NOT NULL DEFAULT 18,
  default_age_max integer NOT NULL DEFAULT 65,
  default_gender text NOT NULL DEFAULT 'all',
  default_placements jsonb NOT NULL DEFAULT '["advantage_plus"]'::jsonb,
  default_audience_type text NOT NULL DEFAULT 'broad',
  default_funnel_stage text NOT NULL DEFAULT 'tof',
  exclude_customers boolean NOT NULL DEFAULT true,
  custom_audiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests_lookalikes jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Anúncio / Criativo (defaults)
  default_cta text NOT NULL DEFAULT 'SHOP_NOW',
  default_creative_format text NOT NULL DEFAULT '1x1',
  default_utm_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_image_strategy text NOT NULL DEFAULT 'product_main_image',

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, ad_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_meta_production_config TO authenticated;
GRANT ALL ON public.ads_meta_production_config TO service_role;

ALTER TABLE public.ads_meta_production_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read meta production config"
  ON public.ads_meta_production_config FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members write meta production config"
  ON public.ads_meta_production_config FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members update meta production config"
  ON public.ads_meta_production_config FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members delete meta production config"
  ON public.ads_meta_production_config FOR DELETE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER trg_ads_meta_production_config_updated_at
  BEFORE UPDATE ON public.ads_meta_production_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
