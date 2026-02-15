-- Add effective_status column to campaigns and adsets
ALTER TABLE public.meta_ad_campaigns ADD COLUMN IF NOT EXISTS effective_status TEXT;
ALTER TABLE public.meta_ad_adsets ADD COLUMN IF NOT EXISTS effective_status TEXT;
ALTER TABLE public.meta_ad_ads ADD COLUMN IF NOT EXISTS effective_status TEXT;