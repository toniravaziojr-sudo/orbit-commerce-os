
-- Corrigir warning: remover view SECURITY DEFINER (usar função no lugar)
DROP VIEW IF EXISTS public.whatsapp_configs_tenant;

-- A função get_whatsapp_config_for_tenant já está criada e é o método seguro
-- Tenants usarão essa função ao invés de query direta na tabela
