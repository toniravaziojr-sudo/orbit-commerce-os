-- Add target_channel column to media_campaigns for channel selection
ALTER TABLE public.media_campaigns 
ADD COLUMN IF NOT EXISTS target_channel TEXT DEFAULT 'all';

-- Add comment explaining valid values
COMMENT ON COLUMN public.media_campaigns.target_channel IS 'Target channel for campaign: all, blog, facebook, instagram';

-- Add channel column to media_calendar_items 
ALTER TABLE public.media_calendar_items
ADD COLUMN IF NOT EXISTS target_channel TEXT DEFAULT 'instagram';

-- Update content_type enum to remove video types and add blog
-- First, check if we need to update existing values
UPDATE public.media_calendar_items 
SET content_type = 'image' 
WHERE content_type IN ('video', 'reel', 'story');

-- Add blog_post_id column to link calendar items to published blog posts
ALTER TABLE public.media_calendar_items
ADD COLUMN IF NOT EXISTS blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL;

-- Add published_blog_at timestamp
ALTER TABLE public.media_calendar_items
ADD COLUMN IF NOT EXISTS published_blog_at TIMESTAMPTZ;

-- Add auto_publish flag to media_campaigns
ALTER TABLE public.media_campaigns
ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN DEFAULT false;

-- Create index for blog post scheduling
CREATE INDEX IF NOT EXISTS idx_media_calendar_items_blog_scheduling 
ON public.media_calendar_items(scheduled_date, target_channel, status) 
WHERE target_channel = 'blog' AND status = 'approved';