
-- Dropar e recriar get_tenant_module_access com a mesma lógica de bypass
DROP FUNCTION IF EXISTS public.get_tenant_module_access(UUID);

CREATE FUNCTION public.get_tenant_module_access(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_plan_key TEXT;
  v_result JSONB := '[]'::jsonb;
BEGIN
  -- Verificar tenant
  SELECT type, plan, is_special INTO v_tenant
  FROM tenants
  WHERE id = p_tenant_id;
  
  IF v_tenant IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Platform, especial ou unlimited: retornar array vazio (significa acesso total)
  IF v_tenant.type = 'platform' OR v_tenant.is_special = true OR v_tenant.plan = 'unlimited' THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Buscar plano
  SELECT ts.plan_key INTO v_plan_key
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  
  v_plan_key := COALESCE(v_plan_key, v_tenant.plan, 'basico');
  
  -- Retornar todos os acessos de módulos para o plano
  SELECT jsonb_agg(
    jsonb_build_object(
      'module_key', pma.module_key,
      'access_level', pma.access_level,
      'blocked_features', COALESCE(pma.blocked_features, '[]'::jsonb),
      'allowed_features', COALESCE(pma.allowed_features, '[]'::jsonb),
      'notes', pma.notes
    )
  ) INTO v_result
  FROM plan_module_access pma
  WHERE pma.plan_key = v_plan_key;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
