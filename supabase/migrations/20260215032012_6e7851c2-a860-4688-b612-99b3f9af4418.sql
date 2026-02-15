
-- =============================================
-- Fase 12: TikTok Content — Publicação Orgânica
-- Tabelas: tiktok_content_videos, tiktok_content_analytics
-- =============================================

-- 1. Tabela de vídeos publicados/agendados
CREATE TABLE public.tiktok_content_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_video_id TEXT,
  open_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  video_url TEXT,
  share_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  privacy_level TEXT DEFAULT 'public',
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  publish_id TEXT,
  upload_status TEXT,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tiktok_content_videos_tenant ON public.tiktok_content_videos(tenant_id);
CREATE INDEX idx_tiktok_content_videos_status ON public.tiktok_content_videos(tenant_id, status);
CREATE UNIQUE INDEX idx_tiktok_content_videos_tiktok_id ON public.tiktok_content_videos(tenant_id, tiktok_video_id) WHERE tiktok_video_id IS NOT NULL;

-- RLS
ALTER TABLE public.tiktok_content_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select" ON public.tiktok_content_videos
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - insert" ON public.tiktok_content_videos
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - update" ON public.tiktok_content_videos
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - delete" ON public.tiktok_content_videos
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_tiktok_content_videos_updated_at
  BEFORE UPDATE ON public.tiktok_content_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de analytics de vídeos
CREATE TABLE public.tiktok_content_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.tiktok_content_videos(id) ON DELETE CASCADE,
  tiktok_video_id TEXT NOT NULL,
  open_id TEXT,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  full_video_watched_rate NUMERIC(5,2),
  total_time_watched INTEGER DEFAULT 0,
  average_time_watched INTEGER DEFAULT 0,
  impression_sources JSONB DEFAULT '{}',
  audience_territories JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tiktok_content_analytics_tenant ON public.tiktok_content_analytics(tenant_id);
CREATE INDEX idx_tiktok_content_analytics_video ON public.tiktok_content_analytics(video_id);
CREATE UNIQUE INDEX idx_tiktok_content_analytics_unique ON public.tiktok_content_analytics(tenant_id, tiktok_video_id, date);

-- RLS
ALTER TABLE public.tiktok_content_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select" ON public.tiktok_content_analytics
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - insert" ON public.tiktok_content_analytics
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - update" ON public.tiktok_content_analytics
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - delete" ON public.tiktok_content_analytics
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));
