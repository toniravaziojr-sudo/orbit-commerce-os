-- Add favicon_files column to store_settings for multi-size favicon support
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS favicon_files jsonb DEFAULT NULL;

COMMENT ON COLUMN public.store_settings.favicon_files IS 'JSON object with favicon sizes as keys (16, 32, 48, 180) and URLs as values for multi-size favicon support';