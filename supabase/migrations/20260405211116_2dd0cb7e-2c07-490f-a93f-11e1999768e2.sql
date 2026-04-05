-- Add default fiscal origin to fiscal_settings
ALTER TABLE public.fiscal_settings 
ADD COLUMN IF NOT EXISTS origem_fiscal_padrao integer NOT NULL DEFAULT 0;