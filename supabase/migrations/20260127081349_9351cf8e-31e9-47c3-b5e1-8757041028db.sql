-- =====================================================
-- EXTRAS E LIMITES - TRACKING E FATURAMENTO
-- =====================================================

-- 1. Adicionar campos de tracking de extras na tabela tenant_monthly_usage
ALTER TABLE public.tenant_monthly_usage
ADD COLUMN IF NOT EXISTS email_notifications_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS support_interactions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_email_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_whatsapp_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_support_cents INTEGER DEFAULT 0;

-- 2. Adicionar campos na tabela plan_limits para custos unitários de extras
ALTER TABLE public.plan_limits
ADD COLUMN IF NOT EXISTS included_email_notifications INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS included_whatsapp_notifications INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS included_support_interactions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_email_price_cents INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS extra_whatsapp_price_cents INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS extra_support_price_cents INTEGER DEFAULT 10;

-- 3. Atualizar os limites dos planos existentes
UPDATE public.plan_limits SET 
  included_email_notifications = CASE plan_key
    WHEN 'basico' THEN 0  -- Só email básico, sem limite (incluso)
    WHEN 'evolucao' THEN 1000
    WHEN 'profissional' THEN 2500
    WHEN 'avancado' THEN 5000
    WHEN 'impulso' THEN 7500
    WHEN 'consolidar' THEN 15000
    WHEN 'comando_maximo' THEN 25000
    ELSE 1000
  END,
  included_whatsapp_notifications = CASE plan_key
    WHEN 'basico' THEN 0  -- Não tem whatsapp
    WHEN 'evolucao' THEN 0  -- Não tem whatsapp
    WHEN 'profissional' THEN 500
    WHEN 'avancado' THEN 1000
    WHEN 'impulso' THEN 1500
    WHEN 'consolidar' THEN 3000
    WHEN 'comando_maximo' THEN 5000
    ELSE 0
  END,
  included_support_interactions = CASE plan_key
    WHEN 'basico' THEN 0
    WHEN 'evolucao' THEN 0
    WHEN 'profissional' THEN 500
    WHEN 'avancado' THEN 1000
    WHEN 'impulso' THEN 1500
    WHEN 'consolidar' THEN 3000
    WHEN 'comando_maximo' THEN 5000
    ELSE 0
  END
WHERE plan_key IN ('basico', 'evolucao', 'profissional', 'avancado', 'impulso', 'consolidar', 'comando_maximo');

-- =====================================================
-- FUNÇÃO PARA REGISTRAR USO DE NOTIFICAÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_notification_usage(
  p_tenant_id UUID,
  p_channel TEXT,  -- 'email' ou 'whatsapp'
  p_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year_month TEXT;
  v_plan_key TEXT;
  v_included INTEGER;
  v_current_count INTEGER;
  v_extra_price INTEGER;
  v_extra_cents INTEGER := 0;
  v_is_extra BOOLEAN := false;
BEGIN
  v_year_month := get_current_year_month();
  
  -- Buscar limites do plano
  SELECT ts.plan_key INTO v_plan_key
  FROM tenant_subscriptions ts
  WHERE ts.tenant_id = p_tenant_id AND ts.status = 'active';
  
  IF v_plan_key IS NULL THEN
    v_plan_key := 'basico';
  END IF;
  
  -- Buscar limites e preços
  IF p_channel = 'email' THEN
    SELECT pl.included_email_notifications, pl.extra_email_price_cents
    INTO v_included, v_extra_price
    FROM plan_limits pl WHERE pl.plan_key = v_plan_key;
    
    -- Buscar uso atual
    SELECT COALESCE(email_notifications_count, 0) INTO v_current_count
    FROM tenant_monthly_usage
    WHERE tenant_id = p_tenant_id AND year_month = v_year_month;
    
  ELSIF p_channel = 'whatsapp' THEN
    SELECT pl.included_whatsapp_notifications, pl.extra_whatsapp_price_cents
    INTO v_included, v_extra_price
    FROM plan_limits pl WHERE pl.plan_key = v_plan_key;
    
    SELECT COALESCE(whatsapp_notifications_count, 0) INTO v_current_count
    FROM tenant_monthly_usage
    WHERE tenant_id = p_tenant_id AND year_month = v_year_month;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Canal inválido');
  END IF;
  
  v_included := COALESCE(v_included, 0);
  v_extra_price := COALESCE(v_extra_price, 5);
  v_current_count := COALESCE(v_current_count, 0);
  
  -- Calcular extras
  IF v_current_count + p_count > v_included THEN
    v_is_extra := true;
    v_extra_cents := GREATEST(0, (v_current_count + p_count - v_included)) * v_extra_price;
  END IF;
  
  -- Atualizar uso
  IF p_channel = 'email' THEN
    INSERT INTO tenant_monthly_usage (tenant_id, year_month, email_notifications_count, extra_email_cents)
    VALUES (p_tenant_id, v_year_month, p_count, v_extra_cents)
    ON CONFLICT (tenant_id, year_month) DO UPDATE SET
      email_notifications_count = tenant_monthly_usage.email_notifications_count + p_count,
      extra_email_cents = tenant_monthly_usage.extra_email_cents + v_extra_cents,
      updated_at = now();
  ELSIF p_channel = 'whatsapp' THEN
    INSERT INTO tenant_monthly_usage (tenant_id, year_month, whatsapp_notifications_count, extra_whatsapp_cents)
    VALUES (p_tenant_id, v_year_month, p_count, v_extra_cents)
    ON CONFLICT (tenant_id, year_month) DO UPDATE SET
      whatsapp_notifications_count = tenant_monthly_usage.whatsapp_notifications_count + p_count,
      extra_whatsapp_cents = tenant_monthly_usage.extra_whatsapp_cents + v_extra_cents,
      updated_at = now();
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'channel', p_channel,
    'count', p_count,
    'is_extra', v_is_extra,
    'extra_cents', v_extra_cents
  );
END;
$$;

-- =====================================================
-- ATUALIZAR FUNÇÃO DE GERAÇÃO DE FATURA COM EXTRAS
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_tenant_invoice(
  p_tenant_id UUID,
  p_year_month TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_id UUID;
  v_plan_key TEXT;
  v_monthly_fee INTEGER;
  v_fee_bps INTEGER;
  v_gmv BIGINT;
  v_ai_usage INTEGER;
  v_addons_total INTEGER;
  v_variable_fee INTEGER;
  v_extra_email INTEGER;
  v_extra_whatsapp INTEGER;
  v_extra_support INTEGER;
  v_total_extras INTEGER;
  v_total INTEGER;
  v_line_items JSONB;
BEGIN
  -- Buscar dados do plano
  SELECT ts.plan_key, bp.price_monthly_cents, pl.sales_fee_bps
  INTO v_plan_key, v_monthly_fee, v_fee_bps
  FROM tenant_subscriptions ts
  JOIN billing_plans bp ON bp.plan_key = ts.plan_key
  LEFT JOIN plan_limits pl ON pl.plan_key = ts.plan_key
  WHERE ts.tenant_id = p_tenant_id;
  
  IF v_plan_key IS NULL THEN
    -- Plano básico: taxa sobre vendas, sem mensalidade fixa
    v_plan_key := 'basico';
    v_monthly_fee := 0;
    v_fee_bps := 250; -- 2.5%
  END IF;
  
  -- Buscar uso mensal
  SELECT 
    COALESCE(gmv_cents, 0), 
    COALESCE(ai_usage_cents, 0),
    COALESCE(extra_email_cents, 0),
    COALESCE(extra_whatsapp_cents, 0),
    COALESCE(extra_support_cents, 0)
  INTO v_gmv, v_ai_usage, v_extra_email, v_extra_whatsapp, v_extra_support
  FROM tenant_monthly_usage
  WHERE tenant_id = p_tenant_id AND year_month = p_year_month;
  
  v_gmv := COALESCE(v_gmv, 0);
  v_ai_usage := COALESCE(v_ai_usage, 0);
  v_extra_email := COALESCE(v_extra_email, 0);
  v_extra_whatsapp := COALESCE(v_extra_whatsapp, 0);
  v_extra_support := COALESCE(v_extra_support, 0);
  
  -- Calcular fee variável (bps = basis points, 100bps = 1%)
  v_fee_bps := COALESCE(v_fee_bps, 0);
  v_variable_fee := (v_gmv * v_fee_bps / 10000)::INTEGER;
  
  -- Calcular total de extras
  v_total_extras := v_extra_email + v_extra_whatsapp + v_extra_support;
  
  -- Buscar addons pendentes
  SELECT COALESCE(SUM(price_cents), 0)
  INTO v_addons_total
  FROM tenant_addons
  WHERE tenant_id = p_tenant_id AND status = 'pending';
  
  -- Calcular total
  v_total := v_monthly_fee + v_variable_fee + v_ai_usage + v_total_extras + COALESCE(v_addons_total, 0);
  
  -- Montar line items
  v_line_items := jsonb_build_array();
  
  -- Adicionar mensalidade se não for zero
  IF v_monthly_fee > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'base_fee', 'description', 'Mensalidade ' || v_plan_key, 'amount_cents', v_monthly_fee)
    );
  END IF;
  
  -- Taxa sobre vendas
  IF v_variable_fee > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'variable_fee', 'description', 'Taxa sobre vendas (' || (v_fee_bps::DECIMAL / 100) || '%)', 'amount_cents', v_variable_fee)
    );
  END IF;
  
  -- Consumo de IA
  IF v_ai_usage > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'ai_usage', 'description', 'Consumo de IA', 'amount_cents', v_ai_usage)
    );
  END IF;
  
  -- Extras de email
  IF v_extra_email > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'extra_email', 'description', 'Emails excedentes', 'amount_cents', v_extra_email)
    );
  END IF;
  
  -- Extras de WhatsApp
  IF v_extra_whatsapp > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'extra_whatsapp', 'description', 'WhatsApp excedentes', 'amount_cents', v_extra_whatsapp)
    );
  END IF;
  
  -- Extras de Suporte
  IF v_extra_support > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'extra_support', 'description', 'Atendimentos excedentes', 'amount_cents', v_extra_support)
    );
  END IF;
  
  -- Add-ons
  IF v_addons_total > 0 THEN
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object('type', 'addons', 'description', 'Add-ons', 'amount_cents', v_addons_total)
    );
  END IF;
  
  -- Inserir ou atualizar fatura
  INSERT INTO tenant_invoices (
    tenant_id, year_month, base_fee_cents, variable_fee_cents, ai_fee_cents, 
    addons_cents, total_cents, status, line_items, due_date
  ) VALUES (
    p_tenant_id, p_year_month, v_monthly_fee, v_variable_fee, v_ai_usage + v_total_extras,
    COALESCE(v_addons_total, 0), v_total, 'open', v_line_items, 
    (TO_DATE(p_year_month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' + INTERVAL '5 days')::DATE
  )
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    base_fee_cents = EXCLUDED.base_fee_cents,
    variable_fee_cents = EXCLUDED.variable_fee_cents,
    ai_fee_cents = EXCLUDED.ai_fee_cents,
    addons_cents = EXCLUDED.addons_cents,
    total_cents = EXCLUDED.total_cents,
    line_items = EXCLUDED.line_items,
    status = CASE WHEN tenant_invoices.status = 'paid' THEN 'paid' ELSE 'open' END,
    updated_at = now()
  RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;

-- =====================================================
-- PLANO BÁSICO AUTOMÁTICO NA CRIAÇÃO DE TENANT
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_tenant_for_user(p_name text, p_slug text)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants;
BEGIN
  -- Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verificar se slug já existe
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already exists';
  END IF;

  -- Criar tenant com plano básico por padrão
  INSERT INTO public.tenants (name, slug, plan)
  VALUES (p_name, p_slug, 'start')
  RETURNING * INTO v_tenant;

  -- Criar role de owner para o usuário
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (auth.uid(), v_tenant.id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Atualizar current_tenant_id no profile
  UPDATE public.profiles
  SET current_tenant_id = v_tenant.id
  WHERE id = auth.uid();
  
  -- Criar assinatura no plano básico (status: active, sem método de pagamento)
  INSERT INTO public.tenant_subscriptions (tenant_id, plan_key, status)
  VALUES (v_tenant.id, 'basico', 'active')
  ON CONFLICT (tenant_id) DO NOTHING;
  
  -- Inicializar wallet de créditos com saldo zero
  INSERT INTO public.credit_wallet (tenant_id, balance_credits, reserved_credits)
  VALUES (v_tenant.id, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN v_tenant;
END;
$$;

-- =====================================================
-- FUNÇÃO PARA OBTER ACESSO A MÓDULOS POR PLANO
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_tenant_module_access(p_tenant_id UUID)
RETURNS TABLE(
  module_key TEXT,
  access_level TEXT,
  blocked_features JSONB,
  allowed_features JSONB,
  notes TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pma.module_key,
    pma.access_level,
    pma.blocked_features,
    pma.allowed_features,
    pma.notes
  FROM tenant_subscriptions ts
  JOIN plan_module_access pma ON pma.plan_key = ts.plan_key
  WHERE ts.tenant_id = p_tenant_id
  
  UNION ALL
  
  -- Fallback para plano básico se não tiver assinatura
  SELECT 
    pma.module_key,
    pma.access_level,
    pma.blocked_features,
    pma.allowed_features,
    pma.notes
  FROM plan_module_access pma
  WHERE pma.plan_key = 'basico'
    AND NOT EXISTS (SELECT 1 FROM tenant_subscriptions WHERE tenant_id = p_tenant_id);
$$;

-- =====================================================
-- FUNÇÃO PARA VERIFICAR SE MÓDULO ESTÁ BLOQUEADO
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_module_access(
  p_tenant_id UUID,
  p_module_key TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'has_access', CASE 
      WHEN pma.access_level IN ('full', 'partial') THEN true
      ELSE false
    END,
    'access_level', COALESCE(pma.access_level, 'none'),
    'blocked_features', COALESCE(pma.blocked_features, '[]'::jsonb),
    'allowed_features', COALESCE(pma.allowed_features, '[]'::jsonb),
    'plan_key', ts.plan_key,
    'requires_upgrade', pma.access_level = 'none'
  )
  FROM tenant_subscriptions ts
  LEFT JOIN plan_module_access pma ON pma.plan_key = ts.plan_key AND pma.module_key = p_module_key
  WHERE ts.tenant_id = p_tenant_id
  
  UNION ALL
  
  -- Fallback se não tem assinatura
  SELECT jsonb_build_object(
    'has_access', CASE 
      WHEN pma.access_level IN ('full', 'partial') THEN true
      ELSE false
    END,
    'access_level', COALESCE(pma.access_level, 'none'),
    'blocked_features', COALESCE(pma.blocked_features, '[]'::jsonb),
    'allowed_features', COALESCE(pma.allowed_features, '[]'::jsonb),
    'plan_key', 'basico',
    'requires_upgrade', pma.access_level = 'none' OR pma.access_level IS NULL
  )
  FROM plan_module_access pma
  WHERE pma.plan_key = 'basico' AND pma.module_key = p_module_key
    AND NOT EXISTS (SELECT 1 FROM tenant_subscriptions WHERE tenant_id = p_tenant_id)
  
  LIMIT 1;
$$;