
-- Prevent duplicate system lists per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_marketing_lists_system_unique
ON public.email_marketing_lists (tenant_id, name)
WHERE is_system = true;
