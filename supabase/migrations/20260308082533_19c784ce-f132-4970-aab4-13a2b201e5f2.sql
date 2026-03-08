
ALTER TABLE public.meta_catalog_items 
  ADD COLUMN IF NOT EXISTS last_payload jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_response jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_image_validation jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_version text DEFAULT NULL;
