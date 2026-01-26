-- Add 'scheduled' as valid status for blog_posts
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_status_check;

ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_status_check
CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text]));