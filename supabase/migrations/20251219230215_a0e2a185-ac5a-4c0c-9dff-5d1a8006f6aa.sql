-- Atualizar o valor padrão de target_hostname para shops.comandocentral.com.br
ALTER TABLE public.tenant_domains 
ALTER COLUMN target_hostname SET DEFAULT 'shops.comandocentral.com.br';

-- Atualizar registros existentes que usam o hostname antigo
UPDATE public.tenant_domains 
SET target_hostname = 'shops.comandocentral.com.br'
WHERE target_hostname = 'shops.respeiteohomem.com.br' 
   OR target_hostname IS NULL;