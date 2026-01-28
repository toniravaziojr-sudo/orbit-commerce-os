-- =====================================================
-- YOUTUBE INTEGRATION - Tables, Functions, and RLS
-- =====================================================

-- 1. Add 'youtube' to social_provider enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'youtube' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'social_provider')
  ) THEN
    ALTER TYPE public.social_provider ADD VALUE 'youtube';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create dedicated youtube_connections table for better isolation
CREATE TABLE IF NOT EXISTS public.youtube_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Channel info
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  channel_thumbnail_url TEXT,
  channel_custom_url TEXT,
  subscriber_count INTEGER,
  video_count INTEGER,
  
  -- OAuth tokens (encrypted in production)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Scopes granted
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status TEXT NOT NULL DEFAULT 'connected',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Quota tracking (daily reset)
  quota_used_today INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT now()::date + interval '1 day',
  
  -- Metadata
  profile_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_by UUID REFERENCES auth.users(id),
  
  -- One connection per tenant
  CONSTRAINT unique_tenant_youtube UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own youtube connections"
  ON public.youtube_connections FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can insert own youtube connections"
  ON public.youtube_connections FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can update own youtube connections"
  ON public.youtube_connections FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can delete own youtube connections"
  ON public.youtube_connections FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- 3. Create youtube_uploads queue table for managing upload jobs
CREATE TABLE IF NOT EXISTS public.youtube_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.youtube_connections(id) ON DELETE CASCADE,
  
  -- Video metadata
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  category_id TEXT DEFAULT '22', -- People & Blogs
  privacy_status TEXT NOT NULL DEFAULT 'private', -- private, unlisted, public
  
  -- Scheduling
  publish_at TIMESTAMPTZ, -- For scheduled publishing
  
  -- File info
  file_path TEXT, -- Path in storage
  file_url TEXT, -- Signed URL for upload
  file_size_bytes BIGINT,
  file_mime_type TEXT,
  
  -- Thumbnail
  thumbnail_url TEXT,
  thumbnail_uploaded BOOLEAN DEFAULT false,
  
  -- YouTube response
  youtube_video_id TEXT,
  youtube_video_url TEXT,
  youtube_thumbnail_url TEXT,
  upload_progress INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, uploading, processing, published, failed, cancelled
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Credits/Cost
  credits_reserved INTEGER DEFAULT 0,
  credits_consumed INTEGER DEFAULT 0,
  idempotency_key TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Calendar item reference
  calendar_item_id UUID REFERENCES public.media_calendar_items(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.youtube_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own youtube uploads"
  ON public.youtube_uploads FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can insert own youtube uploads"
  ON public.youtube_uploads FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can update own youtube uploads"
  ON public.youtube_uploads FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can delete own youtube uploads"
  ON public.youtube_uploads FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- 4. Create youtube_analytics table for caching analytics data
CREATE TABLE IF NOT EXISTS public.youtube_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  
  -- Metrics
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  dislikes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  watch_time_minutes BIGINT DEFAULT 0,
  average_view_duration_seconds INTEGER DEFAULT 0,
  
  -- Engagement
  ctr DECIMAL(5,2),
  average_view_percentage DECIMAL(5,2),
  
  -- Traffic sources (JSONB for flexibility)
  traffic_sources JSONB DEFAULT '{}',
  demographics JSONB DEFAULT '{}',
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Timestamps
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint per video per period
  CONSTRAINT unique_video_period UNIQUE (tenant_id, video_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.youtube_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own youtube analytics"
  ON public.youtube_analytics FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can manage own youtube analytics"
  ON public.youtube_analytics FOR ALL
  USING (public.user_has_tenant_access(tenant_id));

-- 5. Add youtube as valid target_channel for media calendar
COMMENT ON COLUMN public.media_calendar_items.target_channel IS 
  'Target channel for item: all, blog, facebook, instagram, youtube';

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_youtube_connections_tenant 
  ON public.youtube_connections(tenant_id);
  
CREATE INDEX IF NOT EXISTS idx_youtube_uploads_tenant_status 
  ON public.youtube_uploads(tenant_id, status);
  
CREATE INDEX IF NOT EXISTS idx_youtube_uploads_calendar_item 
  ON public.youtube_uploads(calendar_item_id);
  
CREATE INDEX IF NOT EXISTS idx_youtube_analytics_video 
  ON public.youtube_analytics(tenant_id, video_id);

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_youtube_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_youtube_connections_updated_at
  BEFORE UPDATE ON public.youtube_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_youtube_updated_at();

CREATE TRIGGER update_youtube_uploads_updated_at
  BEFORE UPDATE ON public.youtube_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_youtube_updated_at();

-- 8. Function to calculate YouTube upload credits cost
-- Based on file size and operations (upload ~1600 quota units = 16 credits)
CREATE OR REPLACE FUNCTION public.calculate_youtube_upload_credits(
  p_file_size_bytes BIGINT,
  p_include_thumbnail BOOLEAN DEFAULT false,
  p_include_captions BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    16 + -- Base upload cost (1600 quota units)
    CASE WHEN p_include_thumbnail THEN 1 ELSE 0 END + -- Thumbnail upload
    CASE WHEN p_include_captions THEN 2 ELSE 0 END + -- Captions upload
    (p_file_size_bytes / (1024 * 1024 * 1024))::INTEGER -- +1 credit per GB
  )::INTEGER;
$$;

-- 9. OAuth state table for secure flow
CREATE TABLE IF NOT EXISTS public.youtube_oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  redirect_url TEXT,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes'
);

-- Enable RLS
ALTER TABLE public.youtube_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own oauth states"
  ON public.youtube_oauth_states FOR ALL
  USING (user_id = auth.uid());

-- Cleanup function for expired states
CREATE OR REPLACE FUNCTION public.cleanup_expired_youtube_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.youtube_oauth_states
  WHERE expires_at < now() - interval '1 hour';
END;
$$;