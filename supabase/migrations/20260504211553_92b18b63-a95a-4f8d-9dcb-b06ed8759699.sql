
-- ============================================================
-- FASE 2A: Motor Universal de Créditos v2
-- ============================================================

-- 1. Ajustes estruturais em credit_ledger
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS reference_ledger_id uuid REFERENCES public.credit_ledger(id),
  ADD COLUMN IF NOT EXISTS operation_status text,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference 
  ON public.credit_ledger(reference_ledger_id) 
  WHERE reference_ledger_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_orphan_reserve
  ON public.credit_ledger(tenant_id, created_at)
  WHERE transaction_type = 'reserve';

-- 2. Ajustes em service_usage_events
ALTER TABLE public.service_usage_events
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reservation_ledger_id uuid REFERENCES public.credit_ledger(id);

CREATE OR REPLACE FUNCTION public.touch_service_usage_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_service_usage_events ON public.service_usage_events;
CREATE TRIGGER trg_touch_service_usage_events
  BEFORE UPDATE ON public.service_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_service_usage_events();

-- 3. Tabela tenant_credit_motor_config
CREATE TABLE IF NOT EXISTS public.tenant_credit_motor_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  motor_v2_enabled boolean NOT NULL DEFAULT false,
  shadow_categories text[] NOT NULL DEFAULT '{}',
  live_categories text[] NOT NULL DEFAULT '{}',
  shadow_started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tenant_credit_motor_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin manage motor config"
  ON public.tenant_credit_motor_config FOR ALL
  USING (public.is_platform_admin_by_auth())
  WITH CHECK (public.is_platform_admin_by_auth());

-- 4. fx_rates hardening — remover leitura authenticated
DROP POLICY IF EXISTS "Authenticated read fx_rates" ON public.fx_rates;

-- ============================================================
-- RPCs v2
-- ============================================================

-- Helper interno: pega pricing ativo mais recente
CREATE OR REPLACE FUNCTION public._get_active_pricing(p_service_key text)
RETURNS TABLE(id uuid, service_key text, category text, provider text, unit text, cost_usd numeric, markup_pct numeric, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, service_key, category, provider, unit, cost_usd, markup_pct, is_active
  FROM public.service_pricing
  WHERE service_key = p_service_key AND is_active = true
  ORDER BY effective_from DESC NULLS LAST, created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._get_active_fx(p_base text DEFAULT 'USD', p_quote text DEFAULT 'BRL')
RETURNS TABLE(rate numeric, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT rate, source FROM public.fx_rates
  WHERE base = p_base AND quote = p_quote
  ORDER BY effective_from DESC LIMIT 1;
$$;

-- Helper de cálculo de unidades → quantidade base
CREATE OR REPLACE FUNCTION public._compute_units_quantity(p_unit text, p_units jsonb)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE q numeric;
BEGIN
  IF p_units IS NULL THEN RETURN 1; END IF;
  CASE p_unit
    WHEN 'second' THEN q := COALESCE((p_units->>'seconds')::numeric, 1);
    WHEN 'minute' THEN q := COALESCE((p_units->>'minutes')::numeric, 1);
    WHEN 'image'  THEN q := COALESCE((p_units->>'images')::numeric, 1);
    WHEN 'email'  THEN q := COALESCE((p_units->>'emails')::numeric, 1);
    WHEN 'message' THEN q := COALESCE((p_units->>'messages')::numeric, 1);
    WHEN 'page'   THEN q := COALESCE((p_units->>'pages')::numeric, 1);
    WHEN 'window' THEN q := COALESCE((p_units->>'windows')::numeric, 1);
    WHEN 'emission' THEN q := COALESCE((p_units->>'emissions')::numeric, 1);
    WHEN 'per_1m_tokens_in'  THEN q := COALESCE((p_units->>'tokens_in')::numeric, 0) / 1000000.0;
    WHEN 'per_1m_tokens_out' THEN q := COALESCE((p_units->>'tokens_out')::numeric, 0) / 1000000.0;
    ELSE q := COALESCE((p_units->>'quantity')::numeric, 1);
  END CASE;
  RETURN GREATEST(q, 0);
END; $$;

-- ESTIMATE INTERNAL (admin/service_role)
CREATE OR REPLACE FUNCTION public.estimate_credits_internal(
  p_service_key text, p_units jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  credits_estimated integer, cost_usd_snap numeric, sell_usd_snap numeric,
  sell_brl_snap numeric, fx_rate_snap numeric, pricing_id uuid,
  markup_pct_snap numeric, category text, service_key text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p RECORD; fx RECORD; q numeric; cost numeric; sell_usd numeric; sell_brl numeric; credits int;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0::numeric,0::numeric,0::numeric,0::numeric,NULL::uuid,0::numeric,NULL::text,p_service_key;
    RETURN;
  END IF;
  SELECT * INTO p FROM public._get_active_pricing(p_service_key);
  IF p.id IS NULL THEN
    RETURN QUERY SELECT false,'pricing_not_found','Preço não encontrado para '||p_service_key,0,0::numeric,0::numeric,0::numeric,0::numeric,NULL::uuid,0::numeric,NULL::text,p_service_key;
    RETURN;
  END IF;
  SELECT * INTO fx FROM public._get_active_fx('USD','BRL');
  IF fx.rate IS NULL THEN
    RETURN QUERY SELECT false,'fx_not_found','Câmbio USD/BRL ausente',0,0::numeric,0::numeric,0::numeric,0::numeric,p.id,p.markup_pct,p.category,p.service_key;
    RETURN;
  END IF;
  q := public._compute_units_quantity(p.unit, p_units);
  cost := p.cost_usd * q;
  sell_usd := cost * (1 + p.markup_pct/100.0);
  sell_brl := sell_usd * fx.rate;
  credits := GREATEST(1, CEIL(sell_usd / 0.01)::int);
  RETURN QUERY SELECT true, NULL::text, NULL::text, credits, cost, sell_usd, sell_brl, fx.rate, p.id, p.markup_pct, p.category, p.service_key;
END; $$;

-- ESTIMATE PUBLIC (tenant-safe, sem custo/markup)
CREATE OR REPLACE FUNCTION public.estimate_credits_public(
  p_tenant_id uuid, p_service_key text, p_units jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  credits_estimated integer, sell_brl_estimated numeric,
  category text, service_key text, pricing_id uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0::numeric,NULL::text,p_service_key,NULL::uuid;
    RETURN;
  END IF;
  SELECT * INTO r FROM public.estimate_credits_internal(p_service_key, p_units);
  -- chamada acima é admin-only; aqui re-executamos lógica sem o gate
  -- alternativa: replicar lógica. Para evitar duplicação, fazemos cálculo direto.
  DECLARE p RECORD; fx RECORD; q numeric; cost numeric; sell_usd numeric; sell_brl numeric; credits int;
  BEGIN
    SELECT * INTO p FROM public._get_active_pricing(p_service_key);
    IF p.id IS NULL THEN
      RETURN QUERY SELECT false,'pricing_not_found','Preço não disponível',0,0::numeric,NULL::text,p_service_key,NULL::uuid;
      RETURN;
    END IF;
    SELECT * INTO fx FROM public._get_active_fx('USD','BRL');
    IF fx.rate IS NULL THEN
      RETURN QUERY SELECT false,'fx_not_found','Câmbio indisponível',0,0::numeric,p.category,p.service_key,p.id;
      RETURN;
    END IF;
    q := public._compute_units_quantity(p.unit, p_units);
    cost := p.cost_usd * q;
    sell_usd := cost * (1 + p.markup_pct/100.0);
    sell_brl := sell_usd * fx.rate;
    credits := GREATEST(1, CEIL(sell_usd / 0.01)::int);
    RETURN QUERY SELECT true, NULL::text, NULL::text, credits, sell_brl, p.category, p.service_key, p.id;
  END;
END; $$;

-- CHECK BALANCE V2
CREATE OR REPLACE FUNCTION public.check_credit_balance_v2(
  p_tenant_id uuid, p_credits_needed integer DEFAULT 0
) RETURNS TABLE(
  success boolean, has_balance boolean, available_credits integer,
  reserved_credits integer, requested_credits integer,
  missing_credits integer, balance_credits integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
    RETURN QUERY SELECT false,false,0,0,p_credits_needed,p_credits_needed,0;
    RETURN;
  END IF;
  SELECT balance_credits, reserved_credits INTO w FROM public.credit_wallet WHERE tenant_id=p_tenant_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT true,false,0,0,p_credits_needed,p_credits_needed,0;
    RETURN;
  END IF;
  RETURN QUERY SELECT
    true,
    (w.balance_credits - w.reserved_credits) >= p_credits_needed,
    w.balance_credits - w.reserved_credits,
    w.reserved_credits,
    p_credits_needed,
    GREATEST(0, p_credits_needed - (w.balance_credits - w.reserved_credits)),
    w.balance_credits;
END; $$;

-- RESERVE V2
CREATE OR REPLACE FUNCTION public.reserve_credits_v2(
  p_tenant_id uuid, p_user_id uuid, p_service_key text, p_units jsonb,
  p_idempotency_key text, p_job_id uuid DEFAULT NULL, p_feature text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_reservation_ttl_minutes integer DEFAULT 30,
  p_dry_run boolean DEFAULT false
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  reservation_id uuid, credits_reserved integer, balance_after integer,
  pricing_id uuid, sell_brl_snap numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  est RECORD; w RECORD; v_id uuid; expires timestamptz; existing RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',NULL::uuid,0,0,NULL::uuid,0::numeric; RETURN;
  END IF;

  -- Idempotência
  SELECT id, metadata, balance_after INTO existing FROM public.credit_ledger
    WHERE tenant_id=p_tenant_id AND idempotency_key=p_idempotency_key
    LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true,NULL::text,NULL::text, existing.id,
      COALESCE((existing.metadata->>'reserved_credits')::int,0),
      COALESCE(existing.balance_after,0), NULL::uuid, 0::numeric;
    RETURN;
  END IF;

  SELECT * INTO est FROM public.estimate_credits_internal(p_service_key, p_units);
  IF NOT est.success THEN
    RETURN QUERY SELECT false, est.error_code, est.error_message, NULL::uuid,0,0,NULL::uuid,0::numeric; RETURN;
  END IF;

  SELECT balance_credits, reserved_credits INTO w FROM public.credit_wallet
    WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR (w.balance_credits - w.reserved_credits) < est.credits_estimated THEN
    RETURN QUERY SELECT false,'insufficient_balance','Saldo insuficiente',NULL::uuid,
      est.credits_estimated, COALESCE(w.balance_credits,0), est.pricing_id, est.sell_brl_snap;
    RETURN;
  END IF;

  IF p_dry_run THEN
    -- Shadow: registra evento e sai
    IF auth.role() = 'service_role' THEN
      INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, units_json, status, origin_function, metadata)
        VALUES (p_tenant_id,'tenant',p_service_key,est.category,p_units,'shadow','reserve_credits_v2',
          jsonb_build_object('motor_version','v2','dry_run',true,'credits_estimated',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb));
    END IF;
    RETURN QUERY SELECT true,NULL::text,NULL::text,NULL::uuid,
      est.credits_estimated, w.balance_credits, est.pricing_id, est.sell_brl_snap;
    RETURN;
  END IF;

  expires := now() + (p_reservation_ttl_minutes || ' minutes')::interval;

  UPDATE public.credit_wallet SET reserved_credits = reserved_credits + est.credits_estimated, updated_at=now()
    WHERE tenant_id=p_tenant_id;

  INSERT INTO public.credit_ledger(
    tenant_id, user_id, transaction_type, provider, model, feature,
    units_json, cost_usd, sell_usd, credits_delta, idempotency_key, job_id,
    service_key, category, pricing_id, markup_pct_snap, fx_rate_usd_brl, fx_source,
    cost_brl, sell_brl, balance_before, balance_after,
    reservation_expires_at, operation_status, metadata
  ) VALUES (
    p_tenant_id, p_user_id, 'reserve', NULL, NULL, p_feature,
    p_units, est.cost_usd_snap, est.sell_usd_snap, 0, p_idempotency_key, p_job_id,
    est.service_key, est.category, est.pricing_id, est.markup_pct_snap, est.fx_rate_snap, 'fx_rates',
    est.cost_usd_snap * est.fx_rate_snap, est.sell_brl_snap,
    w.balance_credits, w.balance_credits,
    expires, 'reserved',
    jsonb_build_object(
      'motor_version','v2',
      'reserved_credits', est.credits_estimated,
      'available_before', w.balance_credits - w.reserved_credits,
      'available_after',  w.balance_credits - w.reserved_credits - est.credits_estimated
    ) || COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, units_json, status, origin_function, credit_ledger_id, reservation_ledger_id, metadata)
    VALUES (p_tenant_id,'tenant',p_service_key,est.category,p_units,'reserved','reserve_credits_v2', v_id, v_id,
      jsonb_build_object('motor_version','v2','credits_reserved',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb));

  RETURN QUERY SELECT true, NULL::text, NULL::text, v_id, est.credits_estimated, w.balance_credits, est.pricing_id, est.sell_brl_snap;
END; $$;

-- CAPTURE
CREATE OR REPLACE FUNCTION public.capture_reservation(
  p_tenant_id uuid, p_reservation_id uuid, p_actual_units jsonb,
  p_provider_cost_usd numeric DEFAULT NULL, p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  credits_charged integer, credits_released_diff integer,
  balance_after integer, ledger_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  res RECORD; est RECORD; w RECORD; reserved int; actual int;
  cap int; diff int; overflow int := 0; v_id uuid; existing_cap RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0,0,NULL::uuid; RETURN;
  END IF;

  -- Idempotência por idempotency_key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.credit_ledger
      WHERE tenant_id=p_tenant_id AND idempotency_key=p_idempotency_key AND transaction_type='capture' LIMIT 1;
    IF FOUND THEN
      SELECT balance_credits INTO w FROM public.credit_wallet WHERE tenant_id=p_tenant_id;
      RETURN QUERY SELECT true,NULL::text,NULL::text,0,0, COALESCE(w.balance_credits,0), v_id; RETURN;
    END IF;
  END IF;

  SELECT * INTO res FROM public.credit_ledger WHERE id=p_reservation_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR res.transaction_type<>'reserve' OR (res.metadata->>'motor_version') IS DISTINCT FROM 'v2' THEN
    RETURN QUERY SELECT false,'invalid_reservation','Reserva não encontrada ou v1',0,0,0,NULL::uuid; RETURN;
  END IF;

  -- Verifica se já houve capture/release
  SELECT id INTO existing_cap FROM public.credit_ledger
    WHERE reference_ledger_id=p_reservation_id AND transaction_type IN ('capture','release') LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT false,'reservation_already_finalized','Reserva já finalizada',0,0,0,NULL::uuid; RETURN;
  END IF;

  reserved := COALESCE((res.metadata->>'reserved_credits')::int, 0);

  SELECT * INTO est FROM public.estimate_credits_internal(res.service_key, p_actual_units);
  IF NOT est.success THEN
    RETURN QUERY SELECT false, est.error_code, est.error_message,0,0,0,NULL::uuid; RETURN;
  END IF;
  actual := est.credits_estimated;

  IF actual <= reserved THEN
    cap := actual; diff := reserved - actual;
  ELSE
    cap := reserved; diff := 0; overflow := actual - reserved;
  END IF;

  SELECT balance_credits, reserved_credits INTO w FROM public.credit_wallet WHERE tenant_id=p_tenant_id FOR UPDATE;

  UPDATE public.credit_wallet SET
    balance_credits = balance_credits - cap,
    reserved_credits = reserved_credits - reserved,
    lifetime_consumed = lifetime_consumed + cap,
    updated_at = now()
  WHERE tenant_id=p_tenant_id;

  INSERT INTO public.credit_ledger(
    tenant_id, user_id, transaction_type, feature,
    units_json, cost_usd, sell_usd, credits_delta, idempotency_key, job_id,
    service_key, category, pricing_id, markup_pct_snap, fx_rate_usd_brl, fx_source,
    cost_brl, sell_brl, balance_before, balance_after,
    reference_ledger_id, operation_status, metadata
  ) VALUES (
    p_tenant_id, res.user_id, 'capture', res.feature,
    p_actual_units, est.cost_usd_snap, est.sell_usd_snap, -cap, p_idempotency_key, res.job_id,
    est.service_key, est.category, est.pricing_id, est.markup_pct_snap, est.fx_rate_snap, 'fx_rates',
    est.cost_usd_snap * est.fx_rate_snap, est.sell_brl_snap,
    w.balance_credits, w.balance_credits - cap,
    p_reservation_id,
    CASE WHEN overflow>0 THEN 'captured_with_overflow' ELSE 'captured' END,
    jsonb_build_object(
      'motor_version','v2',
      'credits_charged', cap,
      'credits_reserved', reserved,
      'credits_released_diff', diff,
      'overage_uncollected_credits', overflow,
      'provider_cost_usd', p_provider_cost_usd
    ) || COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  UPDATE public.service_usage_events SET
    status = CASE WHEN overflow>0 THEN 'captured_with_overflow' ELSE 'captured' END,
    metadata = metadata || jsonb_build_object('capture_ledger_id', v_id, 'credits_charged', cap, 'overage_uncollected_credits', overflow)
  WHERE reservation_ledger_id = p_reservation_id;

  RETURN QUERY SELECT true, NULL::text, NULL::text, cap, diff, w.balance_credits - cap, v_id;
END; $$;

-- RELEASE
CREATE OR REPLACE FUNCTION public.release_reservation(
  p_tenant_id uuid, p_reservation_id uuid, p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  credits_released integer, ledger_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  res RECORD; reserved int; v_id uuid; existing RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,NULL::uuid; RETURN;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.credit_ledger
      WHERE tenant_id=p_tenant_id AND idempotency_key=p_idempotency_key AND transaction_type='release' LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT true,NULL::text,NULL::text,0,v_id; RETURN;
    END IF;
  END IF;

  SELECT * INTO res FROM public.credit_ledger WHERE id=p_reservation_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR res.transaction_type<>'reserve' OR (res.metadata->>'motor_version') IS DISTINCT FROM 'v2' THEN
    RETURN QUERY SELECT false,'invalid_reservation','Reserva não encontrada ou v1',0,NULL::uuid; RETURN;
  END IF;

  SELECT id INTO existing FROM public.credit_ledger
    WHERE reference_ledger_id=p_reservation_id AND transaction_type IN ('capture','release') LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT false,'reservation_already_finalized','Reserva já finalizada',0,NULL::uuid; RETURN;
  END IF;

  reserved := COALESCE((res.metadata->>'reserved_credits')::int, 0);

  UPDATE public.credit_wallet SET reserved_credits = GREATEST(0, reserved_credits - reserved), updated_at=now()
    WHERE tenant_id=p_tenant_id;

  INSERT INTO public.credit_ledger(
    tenant_id, user_id, transaction_type, feature, units_json,
    cost_usd, sell_usd, credits_delta, idempotency_key, job_id,
    service_key, category, pricing_id, markup_pct_snap, fx_rate_usd_brl, fx_source,
    balance_before, balance_after, reference_ledger_id, operation_status, metadata
  ) VALUES (
    p_tenant_id, res.user_id, 'release', res.feature, res.units_json,
    0, 0, 0, p_idempotency_key, res.job_id,
    res.service_key, res.category, res.pricing_id, res.markup_pct_snap, res.fx_rate_usd_brl, res.fx_source,
    (SELECT balance_credits FROM public.credit_wallet WHERE tenant_id=p_tenant_id),
    (SELECT balance_credits FROM public.credit_wallet WHERE tenant_id=p_tenant_id),
    p_reservation_id, 'released',
    jsonb_build_object('motor_version','v2','released_credits',reserved,'reason',p_reason) || COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  UPDATE public.service_usage_events SET
    status='released',
    metadata = metadata || jsonb_build_object('release_ledger_id', v_id, 'released_credits', reserved, 'reason', p_reason)
  WHERE reservation_ledger_id = p_reservation_id;

  RETURN QUERY SELECT true, NULL::text, NULL::text, reserved, v_id;
END; $$;

-- CHARGE V2 (direto)
CREATE OR REPLACE FUNCTION public.charge_credits_v2(
  p_tenant_id uuid, p_user_id uuid, p_service_key text, p_units jsonb,
  p_idempotency_key text, p_feature text DEFAULT NULL, p_job_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT false
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  credits_charged integer, balance_after integer, ledger_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE est RECORD; w RECORD; v_id uuid; existing RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0,NULL::uuid; RETURN;
  END IF;

  SELECT id, balance_after INTO existing FROM public.credit_ledger
    WHERE tenant_id=p_tenant_id AND idempotency_key=p_idempotency_key AND transaction_type='consume' LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true,NULL::text,NULL::text,0, COALESCE(existing.balance_after,0), existing.id; RETURN;
  END IF;

  SELECT * INTO est FROM public.estimate_credits_internal(p_service_key, p_units);
  IF NOT est.success THEN
    RETURN QUERY SELECT false, est.error_code, est.error_message,0,0,NULL::uuid; RETURN;
  END IF;

  SELECT balance_credits, reserved_credits INTO w FROM public.credit_wallet WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR (w.balance_credits - w.reserved_credits) < est.credits_estimated THEN
    RETURN QUERY SELECT false,'insufficient_balance','Saldo insuficiente', est.credits_estimated, COALESCE(w.balance_credits,0), NULL::uuid; RETURN;
  END IF;

  IF p_dry_run THEN
    IF auth.role() = 'service_role' THEN
      INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, units_json, status, origin_function, metadata)
        VALUES (p_tenant_id,'tenant',p_service_key,est.category,p_units,'shadow','charge_credits_v2',
          jsonb_build_object('motor_version','v2','dry_run',true,'credits_estimated',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb));
    END IF;
    RETURN QUERY SELECT true,NULL::text,NULL::text, est.credits_estimated, w.balance_credits, NULL::uuid; RETURN;
  END IF;

  UPDATE public.credit_wallet SET
    balance_credits = balance_credits - est.credits_estimated,
    lifetime_consumed = lifetime_consumed + est.credits_estimated,
    updated_at=now()
  WHERE tenant_id=p_tenant_id;

  INSERT INTO public.credit_ledger(
    tenant_id, user_id, transaction_type, feature, units_json,
    cost_usd, sell_usd, credits_delta, idempotency_key, job_id,
    service_key, category, pricing_id, markup_pct_snap, fx_rate_usd_brl, fx_source,
    cost_brl, sell_brl, balance_before, balance_after, operation_status, metadata
  ) VALUES (
    p_tenant_id, p_user_id, 'consume', p_feature, p_units,
    est.cost_usd_snap, est.sell_usd_snap, -est.credits_estimated, p_idempotency_key, p_job_id,
    est.service_key, est.category, est.pricing_id, est.markup_pct_snap, est.fx_rate_snap, 'fx_rates',
    est.cost_usd_snap * est.fx_rate_snap, est.sell_brl_snap,
    w.balance_credits, w.balance_credits - est.credits_estimated, 'captured',
    jsonb_build_object('motor_version','v2','credits_charged',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, units_json, status, origin_function, credit_ledger_id, metadata)
    VALUES (p_tenant_id,'tenant',p_service_key,est.category,p_units,'captured','charge_credits_v2', v_id,
      jsonb_build_object('motor_version','v2','credits_charged',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb));

  RETURN QUERY SELECT true,NULL::text,NULL::text, est.credits_estimated, w.balance_credits - est.credits_estimated, v_id;
END; $$;

-- REFUND
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_tenant_id uuid, p_reference_ledger_id uuid, p_credits integer,
  p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
  success boolean, error_code text, error_message text,
  credits_refunded integer, balance_after integer, ledger_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  src RECORD; total_captured int; total_refunded int; refundable int; v_id uuid; existing RECORD; w RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0,NULL::uuid; RETURN;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, balance_after INTO existing FROM public.credit_ledger
      WHERE tenant_id=p_tenant_id AND idempotency_key=p_idempotency_key AND transaction_type='refund' LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT true,NULL::text,NULL::text,0,COALESCE(existing.balance_after,0),existing.id; RETURN;
    END IF;
  END IF;

  IF p_credits <= 0 THEN
    RETURN QUERY SELECT false,'invalid_amount','Créditos devem ser > 0',0,0,NULL::uuid; RETURN;
  END IF;

  SELECT * INTO src FROM public.credit_ledger WHERE id=p_reference_ledger_id AND tenant_id=p_tenant_id;
  IF NOT FOUND OR src.transaction_type NOT IN ('consume','capture') THEN
    RETURN QUERY SELECT false,'invalid_reference','Ledger origem inválido',0,0,NULL::uuid; RETURN;
  END IF;

  total_captured := ABS(src.credits_delta);
  SELECT COALESCE(SUM(credits_delta),0) INTO total_refunded FROM public.credit_ledger
    WHERE reference_ledger_id=p_reference_ledger_id AND transaction_type='refund';
  refundable := total_captured - total_refunded;

  IF p_credits > refundable THEN
    RETURN QUERY SELECT false,'refund_exceeds_captured','Refund > capturado líquido',0,0,NULL::uuid; RETURN;
  END IF;

  SELECT balance_credits INTO w FROM public.credit_wallet WHERE tenant_id=p_tenant_id FOR UPDATE;

  UPDATE public.credit_wallet SET
    balance_credits = balance_credits + p_credits,
    lifetime_consumed = GREATEST(0, lifetime_consumed - p_credits),
    updated_at=now()
  WHERE tenant_id=p_tenant_id;

  INSERT INTO public.credit_ledger(
    tenant_id, user_id, transaction_type, feature, units_json,
    cost_usd, sell_usd, credits_delta, idempotency_key, job_id,
    service_key, category, pricing_id, markup_pct_snap, fx_rate_usd_brl, fx_source,
    balance_before, balance_after, reference_ledger_id, operation_status, metadata
  ) VALUES (
    p_tenant_id, src.user_id, 'refund', src.feature, src.units_json,
    0, 0, p_credits, p_idempotency_key, src.job_id,
    src.service_key, src.category, src.pricing_id, src.markup_pct_snap, src.fx_rate_usd_brl, src.fx_source,
    w.balance_credits, w.balance_credits + p_credits, p_reference_ledger_id, 'refunded',
    jsonb_build_object('motor_version','v2','credits_refunded',p_credits,'reason',p_reason)||COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT true,NULL::text,NULL::text, p_credits, w.balance_credits + p_credits, v_id;
END; $$;

-- RECORD PLATFORM COST
CREATE OR REPLACE FUNCTION public.record_platform_cost(
  p_service_key text, p_units jsonb, p_cost_usd numeric,
  p_origin text, p_origin_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL
) RETURNS TABLE(
  success boolean, error_code text, error_message text, ledger_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  fx RECORD; p RECORD; v_id uuid; existing RECORD; pricing_missing boolean := false;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',NULL::uuid; RETURN;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.platform_cost_ledger
      WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT true,NULL::text,NULL::text,v_id; RETURN;
    END IF;
  END IF;

  SELECT * INTO p FROM public._get_active_pricing(p_service_key);
  IF p.id IS NULL THEN pricing_missing := true; END IF;
  SELECT * INTO fx FROM public._get_active_fx('USD','BRL');

  INSERT INTO public.platform_cost_ledger(
    service_key, category, provider, units_json, cost_usd, cost_brl,
    fx_rate_usd_brl, fx_source, origin, origin_id, pricing_id, idempotency_key, metadata
  ) VALUES (
    p_service_key, COALESCE(p.category,'platform'), COALESCE(p.provider,'unknown'),
    p_units, p_cost_usd, p_cost_usd * COALESCE(fx.rate, 0),
    fx.rate, COALESCE(fx.source,'fx_rates'), p_origin, p_origin_id, p.id, p_idempotency_key,
    jsonb_build_object('pricing_missing',pricing_missing)||COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT true,NULL::text,NULL::text,v_id;
END; $$;

-- Garantir que platform_cost_ledger tem colunas necessárias
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_cost_ledger' AND column_name='idempotency_key') THEN
    ALTER TABLE public.platform_cost_ledger ADD COLUMN idempotency_key text;
    CREATE UNIQUE INDEX ux_pcl_idempotency ON public.platform_cost_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

-- REVOKE direto execução para roles públicas em RPCs mutáveis
REVOKE EXECUTE ON FUNCTION 
  public.reserve_credits_v2(uuid,uuid,text,jsonb,text,uuid,text,jsonb,integer,boolean),
  public.capture_reservation(uuid,uuid,jsonb,numeric,text,jsonb),
  public.release_reservation(uuid,uuid,text,text,jsonb),
  public.charge_credits_v2(uuid,uuid,text,jsonb,text,text,uuid,jsonb,boolean),
  public.refund_credits(uuid,uuid,integer,text,text,jsonb),
  public.record_platform_cost(text,jsonb,numeric,text,uuid,jsonb,text),
  public.estimate_credits_internal(text,jsonb)
FROM PUBLIC, anon, authenticated;
