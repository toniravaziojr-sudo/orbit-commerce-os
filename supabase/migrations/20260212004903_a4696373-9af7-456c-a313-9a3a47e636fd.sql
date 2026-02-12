
-- Social Posts: Track all posts published to Facebook/Instagram via Meta Graph API
-- This table serves as evidence for Meta App Review and operational logs

CREATE TABLE public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_item_id UUID REFERENCES public.media_calendar_items(id) ON DELETE SET NULL,
  
  -- Target
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  post_type TEXT NOT NULL CHECK (post_type IN ('feed', 'story', 'reel', 'carousel')),
  page_id TEXT NOT NULL,
  page_name TEXT,
  instagram_account_id TEXT,
  
  -- Content
  caption TEXT,
  media_urls TEXT[],
  link_url TEXT,
  hashtags TEXT[],
  
  -- Meta IDs (after publishing)
  meta_post_id TEXT,
  meta_container_id TEXT,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Status & Logs (important for App Review evidence)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  error_message TEXT,
  api_response JSONB,
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant queries
CREATE INDEX idx_social_posts_tenant ON public.social_posts(tenant_id, status);
CREATE INDEX idx_social_posts_scheduled ON public.social_posts(scheduled_at) WHERE status = 'scheduled';

-- RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant social posts"
  ON public.social_posts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id = social_posts.tenant_id
  ));

CREATE POLICY "Users can create social posts for own tenant"
  ON public.social_posts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id = social_posts.tenant_id
  ));

CREATE POLICY "Users can update own tenant social posts"
  ON public.social_posts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id = social_posts.tenant_id
  ));

-- Trigger for updated_at
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
