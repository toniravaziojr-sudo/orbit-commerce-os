
CREATE TABLE public.tiktok_ad_audiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_audience_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  name TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'custom',
  cover_num BIGINT DEFAULT 0,
  is_valid BOOLEAN DEFAULT true,
  is_expired BOOLEAN DEFAULT false,
  rules JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_ad_audiences
  ADD CONSTRAINT uq_tiktok_ad_audiences_tenant_audience UNIQUE (tenant_id, tiktok_audience_id);

CREATE INDEX idx_tiktok_ad_audiences_tenant ON public.tiktok_ad_audiences(tenant_id);
CREATE INDEX idx_tiktok_ad_audiences_advertiser ON public.tiktok_ad_audiences(advertiser_id);

ALTER TABLE public.tiktok_ad_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tiktok audiences"
  ON public.tiktok_ad_audiences FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert tiktok audiences"
  ON public.tiktok_ad_audiences FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can update tiktok audiences"
  ON public.tiktok_ad_audiences FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can delete tiktok audiences"
  ON public.tiktok_ad_audiences FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER update_tiktok_ad_audiences_updated_at
  BEFORE UPDATE ON public.tiktok_ad_audiences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
