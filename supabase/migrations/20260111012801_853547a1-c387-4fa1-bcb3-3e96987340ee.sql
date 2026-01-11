-- Add file_id columns for strict file usage tracking
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS logo_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS favicon_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_store_settings_logo_file_id ON public.store_settings(logo_file_id) WHERE logo_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_settings_favicon_file_id ON public.store_settings(favicon_file_id) WHERE favicon_file_id IS NOT NULL;