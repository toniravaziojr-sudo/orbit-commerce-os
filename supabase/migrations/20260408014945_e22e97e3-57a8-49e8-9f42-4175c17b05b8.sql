
CREATE TABLE public.tiktok_ad_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_adgroup_id TEXT NOT NULL,
  campaign_id UUID REFERENCES public.tiktok_ad_campaigns(id) ON DELETE SET NULL,
  tiktok_campaign_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENABLE',
  promotion_type TEXT,
  placement_type TEXT,
  bid_type TEXT,
  bid_price_cents INTEGER,
  budget_mode TEXT,
  budget_cents INTEGER,
  optimize_goal TEXT,
  billing_event TEXT,
  schedule_start_time TEXT,
  schedule_end_time TEXT,
  targeting JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tiktok_adgroup_id)
);

ALTER TABLE public.tiktok_ad_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant ad groups"
  ON public.tiktok_ad_groups FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant ad groups"
  ON public.tiktok_ad_groups FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant ad groups"
  ON public.tiktok_ad_groups FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant ad groups"
  ON public.tiktok_ad_groups FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE INDEX idx_tiktok_ad_groups_tenant ON public.tiktok_ad_groups(tenant_id);
CREATE INDEX idx_tiktok_ad_groups_campaign ON public.tiktok_ad_groups(tiktok_campaign_id);

CREATE TABLE public.tiktok_ad_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_ad_id TEXT NOT NULL,
  adgroup_id UUID REFERENCES public.tiktok_ad_groups(id) ON DELETE SET NULL,
  tiktok_adgroup_id TEXT NOT NULL,
  tiktok_campaign_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENABLE',
  ad_format TEXT,
  ad_text TEXT,
  landing_page_url TEXT,
  call_to_action TEXT,
  image_ids JSONB DEFAULT '[]',
  video_id TEXT,
  thumbnail_url TEXT,
  display_name TEXT,
  identity_id TEXT,
  identity_type TEXT,
  tracking_pixel_id TEXT,
  deeplink TEXT,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, tiktok_ad_id)
);

ALTER TABLE public.tiktok_ad_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant ads"
  ON public.tiktok_ad_ads FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant ads"
  ON public.tiktok_ad_ads FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant ads"
  ON public.tiktok_ad_ads FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant ads"
  ON public.tiktok_ad_ads FOR DELETE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE INDEX idx_tiktok_ad_ads_tenant ON public.tiktok_ad_ads(tenant_id);
CREATE INDEX idx_tiktok_ad_ads_adgroup ON public.tiktok_ad_ads(tiktok_adgroup_id);

CREATE TRIGGER update_tiktok_ad_groups_updated_at
  BEFORE UPDATE ON public.tiktok_ad_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tiktok_ad_ads_updated_at
  BEFORE UPDATE ON public.tiktok_ad_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
