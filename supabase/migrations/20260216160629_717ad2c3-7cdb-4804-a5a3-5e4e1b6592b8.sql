-- Add column for additional pixel IDs (beyond the primary auto-synced one)
ALTER TABLE public.marketing_integrations
ADD COLUMN meta_additional_pixel_ids TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.marketing_integrations.meta_additional_pixel_ids IS 'Additional Meta Pixel IDs beyond the primary one synced from OAuth';
