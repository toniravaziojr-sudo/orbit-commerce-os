
-- =====================================================
-- Google Ads: Cache local para hierarquia completa
-- Campaign > Ad Group > Ad + Keywords + Assets
-- =====================================================

-- 1. Ad Groups (equivalente a AdSets na Meta)
CREATE TABLE public.google_ad_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  google_ad_group_id TEXT NOT NULL,
  google_campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENABLED',
  ad_group_type TEXT, -- SEARCH_STANDARD, DISPLAY_STANDARD, SHOPPING_PRODUCT_ADS, etc.
  cpc_bid_micros BIGINT,
  cpm_bid_micros BIGINT,
  target_cpa_micros BIGINT,
  target_roas NUMERIC,
  effective_status TEXT,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, google_ad_group_id)
);

-- 2. Ads (anúncios individuais)
CREATE TABLE public.google_ad_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  google_ad_id TEXT NOT NULL,
  google_ad_group_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  name TEXT,
  ad_type TEXT NOT NULL, -- RESPONSIVE_SEARCH_AD, RESPONSIVE_DISPLAY_AD, SHOPPING_PRODUCT_AD, etc.
  status TEXT NOT NULL DEFAULT 'ENABLED',
  final_urls TEXT[],
  headlines JSONB, -- [{text, pinned_field}]
  descriptions JSONB, -- [{text, pinned_field}]
  display_url TEXT,
  path1 TEXT,
  path2 TEXT,
  policy_summary JSONB, -- approval status
  ad_strength TEXT, -- EXCELLENT, GOOD, AVERAGE, POOR, UNSPECIFIED
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, google_ad_id)
);

-- 3. Keywords (para campanhas Search)
CREATE TABLE public.google_ad_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  google_criterion_id TEXT NOT NULL,
  google_ad_group_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  keyword_text TEXT NOT NULL,
  match_type TEXT NOT NULL, -- EXACT, PHRASE, BROAD
  status TEXT NOT NULL DEFAULT 'ENABLED',
  cpc_bid_micros BIGINT,
  quality_score INTEGER,
  quality_info JSONB, -- {creative_quality, post_click_quality, search_predicted_ctr}
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, google_criterion_id)
);

-- 4. Assets (imagens, textos, vídeos para PMax/Display)
CREATE TABLE public.google_ad_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  google_asset_id TEXT,
  ad_account_id TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- IMAGE, TEXT, YOUTUBE_VIDEO, MEDIA_BUNDLE, LEAD_FORM, CALL_TO_ACTION
  asset_name TEXT,
  text_content TEXT, -- for TEXT type
  image_url TEXT, -- for IMAGE type
  youtube_video_id TEXT, -- for YOUTUBE_VIDEO type
  storage_path TEXT, -- local storage path
  field_type TEXT, -- HEADLINE, DESCRIPTION, LONG_HEADLINE, BUSINESS_NAME, MARKETING_IMAGE, SQUARE_MARKETING_IMAGE, LOGO, LANDSCAPE_LOGO, YOUTUBE_VIDEO, CALL_TO_ACTION_SELECTION
  performance_label TEXT, -- BEST, GOOD, LOW, LEARNING
  policy_summary JSONB,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, google_asset_id)
);

-- Indexes
CREATE INDEX idx_google_ad_groups_tenant ON public.google_ad_groups(tenant_id);
CREATE INDEX idx_google_ad_groups_campaign ON public.google_ad_groups(tenant_id, google_campaign_id);
CREATE INDEX idx_google_ad_ads_tenant ON public.google_ad_ads(tenant_id);
CREATE INDEX idx_google_ad_ads_adgroup ON public.google_ad_ads(tenant_id, google_ad_group_id);
CREATE INDEX idx_google_ad_keywords_tenant ON public.google_ad_keywords(tenant_id);
CREATE INDEX idx_google_ad_keywords_adgroup ON public.google_ad_keywords(tenant_id, google_ad_group_id);
CREATE INDEX idx_google_ad_assets_tenant ON public.google_ad_assets(tenant_id);
CREATE INDEX idx_google_ad_assets_type ON public.google_ad_assets(tenant_id, asset_type);

-- RLS
ALTER TABLE public.google_ad_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ad_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ad_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ad_assets ENABLE ROW LEVEL SECURITY;

-- Service role only (managed by edge functions)
CREATE POLICY "Service role full access" ON public.google_ad_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.google_ad_ads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.google_ad_keywords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.google_ad_assets FOR ALL USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_google_ad_groups_updated_at BEFORE UPDATE ON public.google_ad_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_google_ad_ads_updated_at BEFORE UPDATE ON public.google_ad_ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_google_ad_keywords_updated_at BEFORE UPDATE ON public.google_ad_keywords FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_google_ad_assets_updated_at BEFORE UPDATE ON public.google_ad_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
