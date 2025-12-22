-- Adicionar flags de quote e tracking em shipping_providers
ALTER TABLE public.shipping_providers 
ADD COLUMN IF NOT EXISTS supports_quote BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS supports_tracking BOOLEAN NOT NULL DEFAULT true;

-- Comentários para documentação
COMMENT ON COLUMN public.shipping_providers.supports_quote IS 'Se este provider oferece cotação de frete no checkout';
COMMENT ON COLUMN public.shipping_providers.supports_tracking IS 'Se este provider suporta consulta de rastreio';