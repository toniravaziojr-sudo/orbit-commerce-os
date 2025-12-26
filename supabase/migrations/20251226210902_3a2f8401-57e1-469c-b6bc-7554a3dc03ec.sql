-- Add dns_all_ok column to track DNS verification state separately from provider
ALTER TABLE public.email_provider_configs
ADD COLUMN IF NOT EXISTS dns_all_ok BOOLEAN DEFAULT false;