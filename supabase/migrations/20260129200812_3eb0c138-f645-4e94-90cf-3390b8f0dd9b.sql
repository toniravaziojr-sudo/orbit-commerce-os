
-- Dropar e recriar check_module_access com lógica correta de bypass para is_special/unlimited
DROP FUNCTION IF EXISTS public.check_module_access(UUID, TEXT);

CREATE FUNCTION public.check_module_access(
  p_tenant_id UUID,
  p_module_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      'plan_key', COALESCE(v_tenant.plan, 'unlimited'),
      'requires_upgrade', false
    );
  END IF;
  
  -- REGRA 3: Para tenants normais, verificar plano na tenant_subscriptions
  SELECT ts.plan_key INTO v_plan_key
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  
  -- Fallback: usar plano da tabela tenants ou 'basico'
  IF v_plan_key IS NULL THEN
    v_plan_key := COALESCE(v_tenant.plan, 'basico');
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
$$;
