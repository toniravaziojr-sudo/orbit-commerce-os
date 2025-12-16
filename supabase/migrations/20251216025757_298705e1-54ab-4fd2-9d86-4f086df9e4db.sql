-- Add banner columns to categories table
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS banner_desktop_url TEXT,
ADD COLUMN IF NOT EXISTS banner_mobile_url TEXT;