-- Add missing columns to platform_announcements table
ALTER TABLE public.platform_announcements 
ADD COLUMN IF NOT EXISTS link_url TEXT,
ADD COLUMN IF NOT EXISTS link_text TEXT;