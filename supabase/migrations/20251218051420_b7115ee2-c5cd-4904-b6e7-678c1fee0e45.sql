-- Create tenant_domains table for custom domain management
CREATE TABLE public.tenant_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  verification_token TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on domain (global uniqueness)
CREATE UNIQUE INDEX idx_tenant_domains_domain_unique ON public.tenant_domains (lower(domain));

-- Partial unique index to ensure only one primary domain per tenant
CREATE UNIQUE INDEX idx_tenant_domains_primary_unique ON public.tenant_domains (tenant_id) WHERE is_primary = true;

-- Index for tenant lookups
CREATE INDEX idx_tenant_domains_tenant_id ON public.tenant_domains (tenant_id);

-- Enable RLS
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admin/owner can manage domains
CREATE POLICY "Admins can view tenant domains"
ON public.tenant_domains
FOR SELECT
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

CREATE POLICY "Admins can insert tenant domains"
ON public.tenant_domains
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

CREATE POLICY "Admins can update tenant domains"
ON public.tenant_domains
FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

CREATE POLICY "Admins can delete tenant domains"
ON public.tenant_domains
FOR DELETE
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_tenant_domains_updated_at
BEFORE UPDATE ON public.tenant_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();