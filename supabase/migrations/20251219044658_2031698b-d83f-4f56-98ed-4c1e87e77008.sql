-- Add type column to tenant_domains to differentiate platform subdomains from custom domains
ALTER TABLE public.tenant_domains 
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'custom';

-- Add check constraint for valid types
ALTER TABLE public.tenant_domains 
ADD CONSTRAINT tenant_domains_type_check 
CHECK (type IN ('platform_subdomain', 'custom'));

-- Add index for faster lookups by type
CREATE INDEX IF NOT EXISTS idx_tenant_domains_type ON public.tenant_domains(type);

-- Add index for domain resolution (used by resolve-domain function)
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain_lookup 
ON public.tenant_domains(domain, status, ssl_status);

-- Comment for documentation
COMMENT ON COLUMN public.tenant_domains.type IS 'Type of domain: platform_subdomain (auto-generated) or custom (user-added)';