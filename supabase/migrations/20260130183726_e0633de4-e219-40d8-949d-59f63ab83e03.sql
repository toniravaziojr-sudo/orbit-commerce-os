-- Fix type mismatch in get_tenant_module_access function
-- The tenant.plan is an enum (tenant_plan) but v_plan_key is TEXT
CREATE OR REPLACE FUNCTION public.get_tenant_module_access(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Buscar plano da assinatura
  SELECT ts.plan_key INTO v_plan_key
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  
  -- FIX: Cast enum to text before COALESCE
  v_plan_key := COALESCE(v_plan_key, v_tenant.plan::text, 'basico');
  
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
$function$;

-- Also fix check_module_access for consistency
CREATE OR REPLACE FUNCTION public.check_module_access(p_tenant_id uuid, p_module_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant RECORD;
  v_plan_key TEXT;
  v_pma RECORD;
BEGIN
  -- PRIMEIRO: Verificar se é tenant especial ou unlimited na tabela tenants
  SELECT type, plan, is_special INTO v_tenant
  FROM tenants
  WHERE id = p_tenant_id;
  
  -- Se não encontrou o tenant, negar acesso
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'access_level', 'none',
      'blocked_features', '[]'::jsonb,
      'allowed_features', '[]'::jsonb,
      'plan_key', 'unknown',
      'requires_upgrade', true
    );
  END IF;
  
  -- REGRA 1: Tenants platform TÊM ACESSO TOTAL (são admins)
  IF v_tenant.type = 'platform' THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'access_level', 'full',
      'blocked_features', '[]'::jsonb,
      'allowed_features', '[]'::jsonb,
      'plan_key', 'platform',
      'requires_upgrade', false
    );
  END IF;
  
  -- REGRA 2: Tenants com is_special=true OU plan='unlimited' TÊM ACESSO TOTAL
  IF v_tenant.is_special = true OR v_tenant.plan = 'unlimited' THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'access_level', 'full',
      'blocked_features', '[]'::jsonb,
      'allowed_features', '[]'::jsonb,
      'plan_key', COALESCE(v_tenant.plan::text, 'unlimited'),
      'requires_upgrade', false
    );
  END IF;
  
  -- REGRA 3: Para tenants normais, verificar plano na tenant_subscriptions
  SELECT ts.plan_key INTO v_plan_key
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  
  -- Fallback: usar plano da tabela tenants ou 'basico' (cast enum to text)
  IF v_plan_key IS NULL THEN
    v_plan_key := COALESCE(v_tenant.plan::text, 'basico');
  END IF;
  
  -- Buscar configuração de acesso ao módulo para o plano
  SELECT * INTO v_pma
  FROM plan_module_access pma
  WHERE pma.plan_key = v_plan_key AND pma.module_key = p_module_key
  LIMIT 1;
  
  -- Se não há configuração para o módulo, permitir por padrão
  IF v_pma IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'access_level', 'full',
      'blocked_features', '[]'::jsonb,
      'allowed_features', '[]'::jsonb,
      'plan_key', v_plan_key,
      'requires_upgrade', false
    );
  END IF;
  
  -- Retornar configuração do módulo
  RETURN jsonb_build_object(
    'has_access', v_pma.access_level IN ('full', 'partial'),
    'access_level', v_pma.access_level,
    'blocked_features', COALESCE(v_pma.blocked_features, '[]'::jsonb),
    'allowed_features', COALESCE(v_pma.allowed_features, '[]'::jsonb),
    'plan_key', v_plan_key,
    'requires_upgrade', v_pma.access_level = 'none'
  );
END;
$function$;