-- ============================================================
-- Wave 3.4-A: Tenant identity guard on critical billing RPCs
-- Pattern: service_role passes through; authenticated users
-- must own the tenant (user_has_tenant_access).
-- Preserves signature, return type, search_path and SECURITY DEFINER.
-- ============================================================

-- 1) check_credit_balance
CREATE OR REPLACE FUNCTION public.check_credit_balance(p_tenant_id uuid, p_credits_needed integer)
 RETURNS TABLE(has_balance boolean, current_balance integer, credits_missing integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    (COALESCE(balance_credits, 0) - COALESCE(reserved_credits, 0)) >= p_credits_needed,
    COALESCE(balance_credits, 0) - COALESCE(reserved_credits, 0),
    GREATEST(0, p_credits_needed - (COALESCE(balance_credits, 0) - COALESCE(reserved_credits, 0)))
  FROM credit_wallet
  WHERE tenant_id = p_tenant_id
  UNION ALL
  SELECT false, 0, p_credits_needed
  WHERE NOT EXISTS (SELECT 1 FROM credit_wallet WHERE tenant_id = p_tenant_id)
  LIMIT 1;
END;
$function$;

-- 2) reserve_credits
CREATE OR REPLACE FUNCTION public.reserve_credits(p_tenant_id uuid, p_credits integer, p_idempotency_key text, p_job_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(success boolean, error_message text, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_available INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- Verificar se já existe transação com essa chave
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key) THEN
    RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
    RETURN;
  END IF;
  
  -- Verificar saldo disponível
  SELECT balance_credits - reserved_credits INTO v_available
  FROM credit_wallet
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  IF v_available IS NULL OR v_available < p_credits THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente'::TEXT, COALESCE(v_available, 0);
    RETURN;
  END IF;
  
  -- Reservar créditos
  UPDATE credit_wallet
  SET reserved_credits = reserved_credits + p_credits,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Registrar no ledger
  INSERT INTO credit_ledger (
    tenant_id, transaction_type, credits_delta, idempotency_key, job_id
  ) VALUES (
    p_tenant_id, 'reserve', -p_credits, p_idempotency_key, p_job_id
  );
  
  RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
END;
$function$;

-- 3) consume_credits
CREATE OR REPLACE FUNCTION public.consume_credits(p_tenant_id uuid, p_user_id uuid, p_credits integer, p_idempotency_key text, p_provider text, p_model text, p_feature text, p_units_json jsonb, p_cost_usd numeric, p_job_id uuid DEFAULT NULL::uuid, p_from_reserve boolean DEFAULT false)
 RETURNS TABLE(success boolean, error_message text, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sell_usd DECIMAL;
  v_available INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
  END IF;

  -- Verificar duplicação
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE idempotency_key = p_idempotency_key AND transaction_type = 'consume') THEN
    RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
    RETURN;
  END IF;
  
  -- Calcular preço de venda (markup 50%)
  v_sell_usd := p_cost_usd * 1.5;
  
  IF p_from_reserve THEN
    UPDATE credit_wallet
    SET reserved_credits = reserved_credits - p_credits,
        balance_credits = balance_credits - p_credits,
        lifetime_consumed = lifetime_consumed + p_credits,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  ELSE
    SELECT balance_credits - reserved_credits INTO v_available
    FROM credit_wallet
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;
    
    IF v_available IS NULL OR v_available < p_credits THEN
      RETURN QUERY SELECT false, 'Saldo insuficiente'::TEXT, COALESCE(v_available, 0);
      RETURN;
    END IF;
    
    UPDATE credit_wallet
    SET balance_credits = balance_credits - p_credits,
        lifetime_consumed = lifetime_consumed + p_credits,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Registrar no ledger
  INSERT INTO credit_ledger (
    tenant_id, user_id, transaction_type, provider, model, feature,
    units_json, cost_usd, sell_usd, credits_delta, idempotency_key, job_id
  ) VALUES (
    p_tenant_id, p_user_id, 'consume', p_provider, p_model, p_feature,
    p_units_json, p_cost_usd, v_sell_usd, -p_credits, p_idempotency_key, p_job_id
  );
  
  RETURN QUERY SELECT true, NULL::TEXT, (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
END;
$function$;