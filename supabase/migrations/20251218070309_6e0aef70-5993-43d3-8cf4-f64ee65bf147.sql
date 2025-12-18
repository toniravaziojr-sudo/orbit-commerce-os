-- Fase 2: Evoluir tenant_domains para suportar provisionamento SSL e roteamento

-- Adicionar novos campos para provisionamento e status SSL
ALTER TABLE public.tenant_domains 
ADD COLUMN IF NOT EXISTS ssl_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS target_hostname text DEFAULT 'shops.respeiteohomem.com.br';

-- Criar índice para lookup rápido por domínio (usado pelo Worker)
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain_lookup 
ON public.tenant_domains (lower(domain)) 
WHERE status = 'verified' AND is_primary = true;

-- Criar índice único global para evitar que o mesmo domínio seja cadastrado por múltiplos tenants
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_domains_domain_unique 
ON public.tenant_domains (lower(domain));

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.tenant_domains.ssl_status IS 'Status do SSL: none, pending, active, failed';
COMMENT ON COLUMN public.tenant_domains.external_id IS 'ID do Custom Hostname no Cloudflare';
COMMENT ON COLUMN public.tenant_domains.target_hostname IS 'Hostname alvo para CNAME (SaaS hostname)';