
-- Corrigir função check_module_access para retornar 'full' quando módulo não configurado
CREATE OR REPLACE FUNCTION public.check_module_access(
  p_tenant_id UUID,
  p_module_key TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Primeiro tenta buscar com base na assinatura do tenant
  SELECT jsonb_build_object(
    'has_access', CASE 
      WHEN pma.id IS NULL THEN true  -- Se não configurado, permitir
      WHEN pma.access_level IN ('full', 'partial') THEN true
      ELSE false
    END,
    'access_level', COALESCE(pma.access_level, 'full'),  -- Default: full
    'blocked_features', COALESCE(pma.blocked_features, '[]'::jsonb),
    'allowed_features', COALESCE(pma.allowed_features, '[]'::jsonb),
    'plan_key', ts.plan_key,
    'requires_upgrade', CASE 
      WHEN pma.id IS NULL THEN false  -- Se não configurado, não precisa upgrade
      ELSE pma.access_level = 'none'
    END
  )
  FROM tenant_subscriptions ts
  LEFT JOIN plan_module_access pma ON pma.plan_key = ts.plan_key AND pma.module_key = p_module_key
  WHERE ts.tenant_id = p_tenant_id
  
  UNION ALL
  
  -- Fallback se não tem assinatura - usar plano basico
  SELECT jsonb_build_object(
    'has_access', CASE 
      WHEN pma.id IS NULL THEN true  -- Se não configurado, permitir
      WHEN pma.access_level IN ('full', 'partial') THEN true
      ELSE false
    END,
    'access_level', COALESCE(pma.access_level, 'full'),  -- Default: full
    'blocked_features', COALESCE(pma.blocked_features, '[]'::jsonb),
    'allowed_features', COALESCE(pma.allowed_features, '[]'::jsonb),
    'plan_key', 'basico',
    'requires_upgrade', CASE 
      WHEN pma.id IS NULL THEN false  -- Se não configurado, não precisa upgrade
      ELSE pma.access_level = 'none'
    END
  )
  FROM (SELECT 1) AS dummy
  LEFT JOIN plan_module_access pma ON pma.plan_key = 'basico' AND pma.module_key = p_module_key
  WHERE NOT EXISTS (SELECT 1 FROM tenant_subscriptions WHERE tenant_id = p_tenant_id)
  
  LIMIT 1;
$$;
