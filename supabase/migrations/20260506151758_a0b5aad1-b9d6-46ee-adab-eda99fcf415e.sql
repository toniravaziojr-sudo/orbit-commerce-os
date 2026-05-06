
-- A3.0.3: Adicionar provider nos 4 INSERTs em service_usage_events
-- dentro de reserve_credits_v2 e charge_credits_v2.
-- Provider canônico: COALESCE(NULLIF(p_metadata->>'provider',''), split_part(p_service_key,'.',1))
-- Não altera assinatura, RETURNS TABLE, SECURITY DEFINER, search_path,
-- gates, idempotência, cálculo, GATE PRICE_NOT_APPROVED ou permissões.

CREATE OR REPLACE FUNCTION public.reserve_credits_v2(
  p_tenant_id uuid, p_user_id uuid, p_service_key text, p_units jsonb,
  p_idempotency_key text, p_job_id uuid DEFAULT NULL::uuid,
  p_feature text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb,
  p_reservation_ttl_minutes integer DEFAULT 30, p_dry_run boolean DEFAULT false
)
RETURNS TABLE(success boolean, error_code text, error_message text, reservation_id uuid, credits_reserved integer, balance_after integer, pricing_id uuid, sell_brl_snap numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  est RECORD; w RECORD; v_id uuid; expires timestamptz; existing RECORD;
  v_pricing RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',NULL::uuid,0,0,NULL::uuid,0::numeric; RETURN;
  END IF;

  SELECT cl.id, cl.metadata, cl.balance_after INTO existing
    FROM public.credit_ledger cl
    WHERE cl.tenant_id = p_tenant_id
      AND cl.idempotency_key = p_idempotency_key
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

  IF NOT p_dry_run THEN
    SELECT metadata INTO v_pricing FROM public.service_pricing WHERE id = est.pricing_id;
    IF COALESCE((v_pricing.metadata->>'placeholder')::boolean,false)
       AND NOT COALESCE((v_pricing.metadata->>'approved_for_live')::boolean,false) THEN
      RETURN QUERY SELECT false,'PRICE_NOT_APPROVED',
        'Preço placeholder não aprovado para cobrança live.',
        NULL::uuid, est.credits_estimated, 0, est.pricing_id, est.sell_brl_snap;
      RETURN;
    END IF;
  END IF;

  SELECT balance_credits, reserved_credits INTO w FROM public.credit_wallet
    WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR (w.balance_credits - w.reserved_credits) < est.credits_estimated THEN
    RETURN QUERY SELECT false,'insufficient_balance','Saldo insuficiente',NULL::uuid,
      est.credits_estimated, COALESCE(w.balance_credits,0), est.pricing_id, est.sell_brl_snap;
    RETURN;
  END IF;

  IF p_dry_run THEN
    IF auth.role() = 'service_role' THEN
      INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, provider, units_json, status, origin_function, metadata)
        VALUES (p_tenant_id,'tenant',p_service_key,est.category,
          COALESCE(NULLIF(p_metadata->>'provider',''), split_part(p_service_key,'.',1)),
          p_units,'shadow','reserve_credits_v2',
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

  INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, provider, units_json, status, origin_function, credit_ledger_id, reservation_ledger_id, metadata)
    VALUES (p_tenant_id,'tenant',p_service_key,est.category,
      COALESCE(NULLIF(p_metadata->>'provider',''), split_part(p_service_key,'.',1)),
      p_units,'reserved','reserve_credits_v2', v_id, v_id,
      jsonb_build_object('motor_version','v2','credits_reserved',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb));

  RETURN QUERY SELECT true, NULL::text, NULL::text, v_id, est.credits_estimated, w.balance_credits, est.pricing_id, est.sell_brl_snap;
END; $function$;


CREATE OR REPLACE FUNCTION public.charge_credits_v2(
  p_tenant_id uuid, p_user_id uuid, p_service_key text, p_units jsonb,
  p_idempotency_key text, p_feature text DEFAULT NULL::text,
  p_job_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb,
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE(success boolean, error_code text, error_message text, credits_charged integer, balance_after integer, ledger_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE est RECORD; w RECORD; v_id uuid; existing RECORD; v_pricing RECORD;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0,NULL::uuid; RETURN;
  END IF;

  SELECT cl.id, cl.balance_after INTO existing FROM public.credit_ledger cl
    WHERE cl.tenant_id=p_tenant_id AND cl.idempotency_key=p_idempotency_key AND cl.transaction_type='consume' LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true,NULL::text,NULL::text,0, COALESCE(existing.balance_after,0), existing.id; RETURN;
  END IF;

  SELECT * INTO est FROM public.estimate_credits_internal(p_service_key, p_units);
  IF NOT est.success THEN
    RETURN QUERY SELECT false, est.error_code, est.error_message,0,0,NULL::uuid; RETURN;
  END IF;

  IF NOT p_dry_run THEN
    SELECT metadata INTO v_pricing FROM public.service_pricing WHERE id = est.pricing_id;
    IF COALESCE((v_pricing.metadata->>'placeholder')::boolean,false)
       AND NOT COALESCE((v_pricing.metadata->>'approved_for_live')::boolean,false) THEN
      RETURN QUERY SELECT false,'PRICE_NOT_APPROVED',
        'Preço placeholder não aprovado para cobrança live.',
        est.credits_estimated, 0, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  SELECT balance_credits, reserved_credits INTO w FROM public.credit_wallet WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR (w.balance_credits - w.reserved_credits) < est.credits_estimated THEN
    RETURN QUERY SELECT false,'insufficient_balance','Saldo insuficiente', est.credits_estimated, COALESCE(w.balance_credits,0), NULL::uuid; RETURN;
  END IF;

  IF p_dry_run THEN
    IF auth.role() = 'service_role' THEN
      INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, provider, units_json, status, origin_function, metadata)
        VALUES (p_tenant_id,'tenant',p_service_key,est.category,
          COALESCE(NULLIF(p_metadata->>'provider',''), split_part(p_service_key,'.',1)),
          p_units,'shadow','charge_credits_v2',
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

  INSERT INTO public.service_usage_events(tenant_id, cost_owner, service_key, category, provider, units_json, status, origin_function, credit_ledger_id, metadata)
    VALUES (p_tenant_id,'tenant',p_service_key,est.category,
      COALESCE(NULLIF(p_metadata->>'provider',''), split_part(p_service_key,'.',1)),
      p_units,'captured','charge_credits_v2', v_id,
      jsonb_build_object('motor_version','v2','credits_charged',est.credits_estimated)||COALESCE(p_metadata,'{}'::jsonb));

  RETURN QUERY SELECT true,NULL::text,NULL::text, est.credits_estimated, w.balance_credits - est.credits_estimated, v_id;
END; $function$;
