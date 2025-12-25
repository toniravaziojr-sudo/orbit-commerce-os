-- Add domain verification fields to email_provider_configs
ALTER TABLE public.email_provider_configs
ADD COLUMN IF NOT EXISTS sending_domain TEXT,
ADD COLUMN IF NOT EXISTS resend_domain_id TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'not_started')),
ADD COLUMN IF NOT EXISTS dns_records JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_verify_check_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_verify_error TEXT;

-- Create index for faster lookups by domain
CREATE INDEX IF NOT EXISTS idx_email_provider_configs_sending_domain 
ON public.email_provider_configs(sending_domain) 
WHERE sending_domain IS NOT NULL;