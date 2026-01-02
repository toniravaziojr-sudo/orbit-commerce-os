-- Add certificate fields to fiscal_settings for A1 certificate per tenant
ALTER TABLE public.fiscal_settings 
ADD COLUMN IF NOT EXISTS certificado_pfx BYTEA,
ADD COLUMN IF NOT EXISTS certificado_senha TEXT,
ADD COLUMN IF NOT EXISTS certificado_valido_ate TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificado_cn TEXT,
ADD COLUMN IF NOT EXISTS certificado_serial TEXT,
ADD COLUMN IF NOT EXISTS certificado_cnpj TEXT,
ADD COLUMN IF NOT EXISTS certificado_uploaded_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.fiscal_settings.certificado_pfx IS 'Encrypted A1 certificate .pfx file';
COMMENT ON COLUMN public.fiscal_settings.certificado_senha IS 'Encrypted certificate password';
COMMENT ON COLUMN public.fiscal_settings.certificado_valido_ate IS 'Certificate expiration date';
COMMENT ON COLUMN public.fiscal_settings.certificado_cn IS 'Certificate Common Name';
COMMENT ON COLUMN public.fiscal_settings.certificado_serial IS 'Certificate serial number';
COMMENT ON COLUMN public.fiscal_settings.certificado_cnpj IS 'CNPJ extracted from certificate';
COMMENT ON COLUMN public.fiscal_settings.certificado_uploaded_at IS 'When the certificate was uploaded';