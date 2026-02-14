-- Tabela para transmissões ao vivo do Meta (Facebook/Instagram)
CREATE TABLE public.meta_live_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  live_video_id TEXT,
  stream_url TEXT,
  secure_stream_url TEXT,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  planned_start_time TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  viewer_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_live_streams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant users can view their live streams"
ON public.meta_live_streams FOR SELECT
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can create live streams"
ON public.meta_live_streams FOR INSERT
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update their live streams"
ON public.meta_live_streams FOR UPDATE
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete their live streams"
ON public.meta_live_streams FOR DELETE
USING (public.user_has_tenant_access(tenant_id));

-- Service role bypass
CREATE POLICY "Service role full access to meta_live_streams"
ON public.meta_live_streams FOR ALL
USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_meta_live_streams_updated_at
BEFORE UPDATE ON public.meta_live_streams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_meta_live_streams_tenant ON public.meta_live_streams(tenant_id);
CREATE INDEX idx_meta_live_streams_status ON public.meta_live_streams(tenant_id, status);