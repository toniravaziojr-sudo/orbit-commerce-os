
-- Add CPF field to store_settings for supporting both CPF and CNPJ
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS business_cpf TEXT;

-- Add comment to clarify the fields
COMMENT ON COLUMN public.store_settings.business_cnpj IS 'CNPJ for companies (optional if CPF is provided)';
COMMENT ON COLUMN public.store_settings.business_cpf IS 'CPF for individuals (optional if CNPJ is provided)';
COMMENT ON COLUMN public.store_settings.business_legal_name IS 'Legal name (Razão Social for CNPJ or Full Name for CPF)';
