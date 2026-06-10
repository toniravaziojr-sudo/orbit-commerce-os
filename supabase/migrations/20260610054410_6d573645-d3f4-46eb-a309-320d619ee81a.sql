
CREATE TABLE IF NOT EXISTS public.platform_capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  api_version TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  capabilities_version TEXT NOT NULL,
  adapter_version TEXT NOT NULL DEFAULT 'v0.1',
  capability_hash TEXT NOT NULL,
  capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  docs_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'nao_verificado',
  last_verified_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.platform_capabilities TO authenticated;
GRANT ALL ON public.platform_capabilities TO service_role;
ALTER TABLE public.platform_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_capabilities_read_authenticated"
  ON public.platform_capabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_capabilities_admin_write"
  ON public.platform_capabilities FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.platform_compatibility_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  check_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  previous_hash TEXT,
  current_hash TEXT,
  diff_summary JSONB DEFAULT '{}'::jsonb,
  severity TEXT,
  sources_checked JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.platform_compatibility_checks TO authenticated;
GRANT ALL ON public.platform_compatibility_checks TO service_role;
ALTER TABLE public.platform_compatibility_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_compatibility_checks_read_authenticated"
  ON public.platform_compatibility_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_compatibility_checks_admin_write"
  ON public.platform_compatibility_checks FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.platform_compatibility_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  source_check_id UUID REFERENCES public.platform_compatibility_checks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.platform_compatibility_alerts TO authenticated;
GRANT ALL ON public.platform_compatibility_alerts TO service_role;
ALTER TABLE public.platform_compatibility_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_compatibility_alerts_read_authenticated"
  ON public.platform_compatibility_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_compatibility_alerts_admin_write"
  ON public.platform_compatibility_alerts FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE TRIGGER platform_capabilities_updated_at
  BEFORE UPDATE ON public.platform_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER platform_compatibility_alerts_updated_at
  BEFORE UPDATE ON public.platform_compatibility_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED Meta (verificado)
INSERT INTO public.platform_capabilities
  (platform, api_version, capabilities_version, adapter_version, capability_hash, status,
   last_verified_at, next_check_at, docs_sources, capabilities_json, notes)
VALUES (
  'meta','v21.0','meta-2026-06-10-baseline','v0.1', md5('meta-2026-06-10-baseline'),
  'verificado', NOW(), NOW() + INTERVAL '30 days',
  '[
    {"name":"Meta Marketing API — Campaign","url":"https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group","consulted_at":"2026-06-10"},
    {"name":"Meta Marketing API — AdSet","url":"https://developers.facebook.com/docs/marketing-api/reference/ad-campaign","consulted_at":"2026-06-10"},
    {"name":"Meta Marketing API — Ad Creative","url":"https://developers.facebook.com/docs/marketing-api/reference/ad-creative","consulted_at":"2026-06-10"},
    {"name":"Meta Marketing API — Targeting","url":"https://developers.facebook.com/docs/marketing-api/audiences/reference/advanced-targeting","consulted_at":"2026-06-10"},
    {"name":"Meta Pixel — Standard Events","url":"https://developers.facebook.com/docs/meta-pixel/reference","consulted_at":"2026-06-10"}
  ]'::jsonb,
  jsonb_build_object(
    'supported_objectives', jsonb_build_array('OUTCOME_SALES','OUTCOME_LEADS','OUTCOME_TRAFFIC','OUTCOME_AWARENESS','OUTCOME_ENGAGEMENT','OUTCOME_APP_PROMOTION'),
    'supported_buying_types', jsonb_build_array('AUCTION','RESERVED'),
    'supported_budget_types', jsonb_build_array('daily','lifetime','adset_level','campaign_level'),
    'supported_optimization_goals', jsonb_build_array('OFFSITE_CONVERSIONS','LINK_CLICKS','IMPRESSIONS','REACH','LANDING_PAGE_VIEWS','VALUE','LEAD_GENERATION','QUALITY_LEAD','ENGAGED_USERS'),
    'supported_billing_events', jsonb_build_array('IMPRESSIONS','LINK_CLICKS','THRUPLAY'),
    'supported_conversion_events', jsonb_build_array('PURCHASE','ADD_TO_CART','INITIATED_CHECKOUT','LEAD','COMPLETE_REGISTRATION','VIEW_CONTENT','SEARCH','ADD_PAYMENT_INFO','CONTACT','SUBSCRIBE','START_TRIAL'),
    'supported_conversion_locations', jsonb_build_array('Site','Site e App','App','Site e Loja Física','Site e ligações'),
    'supported_placements', jsonb_build_array('advantage_plus','facebook_feed','instagram_feed','instagram_reels','facebook_reels','facebook_stories','instagram_stories','marketplace','messenger','audience_network'),
    'supported_ctas', jsonb_build_array('SHOP_NOW','LEARN_MORE','SIGN_UP','BUY_NOW','ORDER_NOW','GET_OFFER','SEND_WHATSAPP_MESSAGE','CONTACT_US','SUBSCRIBE','DOWNLOAD','WATCH_MORE','BOOK_NOW','APPLY_NOW'),
    'supported_creative_formats', jsonb_build_array('SINGLE_IMAGE','SINGLE_VIDEO','CAROUSEL','COLLECTION'),
    'required_fields_by_objective', jsonb_build_object(
      'OUTCOME_SALES', jsonb_build_array('campaign.name','campaign.objective','campaign.budget','adset.optimization_goal','adset.conversion_event','adset.location','adset.age_range','adset.gender','adset.placements','ad.headline','ad.primary_text','ad.cta','ad.destination_url'),
      'OUTCOME_LEADS', jsonb_build_array('campaign.name','campaign.objective','campaign.budget','adset.optimization_goal','adset.conversion_event','adset.location','adset.age_range','adset.gender','adset.placements','ad.headline','ad.primary_text','ad.cta','ad.destination_url'),
      'OUTCOME_TRAFFIC', jsonb_build_array('campaign.name','campaign.objective','campaign.budget','adset.optimization_goal','adset.location','adset.age_range','adset.gender','adset.placements','ad.headline','ad.primary_text','ad.cta','ad.destination_url')
    ),
    'safe_defaults', jsonb_build_object(
      'campaign.buying_type','AUCTION',
      'campaign.planned_status','PAUSED',
      'adset.location','BR',
      'adset.placements', jsonb_build_array('advantage_plus'),
      'adset.conversion_location','Site',
      'adset.age_min', 18,
      'adset.age_max', 65,
      'adset.gender','Todos'
    ),
    'known_limitations', jsonb_build_array(
      'Categorias especiais (Crédito/Emprego/Moradia/Política) restringem targeting demográfico',
      'Advantage+ shopping têm restrições próprias de targeting',
      'Pixel exige evento padrão (não custom) para otimização confiável'
    )
  ),
  'Baseline manual semeada na Onda 0 — Gestor de Tráfego IA v2026-06-10'
)
ON CONFLICT (platform) DO NOTHING;

-- SEED Google (não verificado)
INSERT INTO public.platform_capabilities
  (platform, capabilities_version, adapter_version, capability_hash, status, docs_sources, capabilities_json, notes)
VALUES (
  'google','google-placeholder','v0.0', md5('google-placeholder'),'nao_verificado',
  '[{"name":"Google Ads API — Reference","url":"https://developers.google.com/google-ads/api/reference/rpc","consulted_at":null}]'::jsonb,
  jsonb_build_object('safe_defaults', jsonb_build_object('campaign.planned_status','PAUSED')),
  'Placeholder não verificado — bloqueia geração de criativo e publicação até verificação humana'
) ON CONFLICT (platform) DO NOTHING;

-- SEED TikTok (não verificado)
INSERT INTO public.platform_capabilities
  (platform, capabilities_version, adapter_version, capability_hash, status, docs_sources, capabilities_json, notes)
VALUES (
  'tiktok','tiktok-placeholder','v0.0', md5('tiktok-placeholder'),'nao_verificado',
  '[{"name":"TikTok Marketing API — Overview","url":"https://business-api.tiktok.com/portal/docs","consulted_at":null}]'::jsonb,
  jsonb_build_object('safe_defaults', jsonb_build_object('campaign.planned_status','PAUSED')),
  'Placeholder não verificado — bloqueia geração de criativo e publicação até verificação humana'
) ON CONFLICT (platform) DO NOTHING;
