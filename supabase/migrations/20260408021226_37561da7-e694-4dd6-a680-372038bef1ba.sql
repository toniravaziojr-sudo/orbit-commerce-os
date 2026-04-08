
CREATE TABLE public.tiktok_ad_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_asset_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'image',
  file_name TEXT,
  file_url TEXT,
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  duration NUMERIC DEFAULT 0,
  file_size BIGINT DEFAULT 0,
  format TEXT,
  signature TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_ad_assets
  ADD CONSTRAINT uq_tiktok_ad_assets_tenant_asset UNIQUE (tenant_id, tiktok_asset_id);

CREATE INDEX idx_tiktok_ad_assets_tenant ON public.tiktok_ad_assets(tenant_id);
CREATE INDEX idx_tiktok_ad_assets_type ON public.tiktok_ad_assets(asset_type);

ALTER TABLE public.tiktok_ad_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tiktok assets"
  ON public.tiktok_ad_assets FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert tiktok assets"
  ON public.tiktok_ad_assets FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update tiktok assets"
  ON public.tiktok_ad_assets FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can delete tiktok assets"
  ON public.tiktok_ad_assets FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER update_tiktok_ad_assets_updated_at
  BEFORE UPDATE ON public.tiktok_ad_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
