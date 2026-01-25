-- Add icon_image_url column to newsletter_popup_configs
-- This allows replacing the emoji icon with a custom mini image
ALTER TABLE public.newsletter_popup_configs
ADD COLUMN IF NOT EXISTS icon_image_url TEXT DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.newsletter_popup_configs.icon_image_url IS 'URL de imagem customizada para substituir o emoji/ícone do incentivo';