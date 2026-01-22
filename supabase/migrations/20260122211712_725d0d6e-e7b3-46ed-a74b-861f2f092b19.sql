-- Remove a constraint única antiga que só considera tenant_id
ALTER TABLE public.whatsapp_configs DROP CONSTRAINT IF EXISTS unique_tenant_whatsapp;

-- Cria nova constraint única composta (tenant_id, provider) para suportar múltiplos providers por tenant
ALTER TABLE public.whatsapp_configs
ADD CONSTRAINT whatsapp_configs_tenant_provider_unique UNIQUE (tenant_id, provider);