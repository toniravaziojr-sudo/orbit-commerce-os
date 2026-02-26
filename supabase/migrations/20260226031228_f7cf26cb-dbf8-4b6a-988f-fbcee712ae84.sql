-- Add regulatory fields (Anvisa, etc.) and warranty to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS regulatory_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS warranty_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS warranty_duration TEXT DEFAULT NULL;

COMMENT ON COLUMN public.products.regulatory_info IS 'Regulatory info like Anvisa notification, AFE certificate, CONAMA license';
COMMENT ON COLUMN public.products.warranty_type IS 'Warranty type: vendor, factory, none';
COMMENT ON COLUMN public.products.warranty_duration IS 'Warranty duration text, e.g. "6 meses", "1 ano"';