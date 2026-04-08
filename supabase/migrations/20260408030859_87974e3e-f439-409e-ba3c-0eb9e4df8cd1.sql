-- Add profile stats columns to tiktok_content_connections
ALTER TABLE public.tiktok_content_connections
  ADD COLUMN IF NOT EXISTS follower_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bio_description text,
  ADD COLUMN IF NOT EXISTS profile_synced_at timestamptz;

-- Create scheduled posts table
CREATE TABLE public.tiktok_content_scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  privacy_level text NOT NULL DEFAULT 'SELF_ONLY',
  video_storage_path text,
  video_size bigint,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  publish_id text,
  tiktok_video_id text,
  error_message text,
  published_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiktok_scheduled_posts_tenant ON public.tiktok_content_scheduled_posts(tenant_id);
CREATE INDEX idx_tiktok_scheduled_posts_status ON public.tiktok_content_scheduled_posts(status, scheduled_at);

ALTER TABLE public.tiktok_content_scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view scheduled posts"
  ON public.tiktok_content_scheduled_posts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tiktok_content_scheduled_posts.tenant_id
  ));

CREATE POLICY "Tenant users can create scheduled posts"
  ON public.tiktok_content_scheduled_posts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tiktok_content_scheduled_posts.tenant_id
  ));

CREATE POLICY "Tenant users can update scheduled posts"
  ON public.tiktok_content_scheduled_posts FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tiktok_content_scheduled_posts.tenant_id
  ));

CREATE POLICY "Tenant users can delete scheduled posts"
  ON public.tiktok_content_scheduled_posts FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tiktok_content_scheduled_posts.tenant_id
  ));