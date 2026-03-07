-- Índice composto otimizado para lookup de domínio custom no resolveTenant
-- Cobre a query .or() com filtros status=verified, ssl_status=active, type=custom
CREATE INDEX IF NOT EXISTS idx_tenant_domains_custom_domain_lookup 
ON public.tenant_domains (domain, status, ssl_status, type)
WHERE status = 'verified' AND ssl_status = 'active' AND type = 'custom';