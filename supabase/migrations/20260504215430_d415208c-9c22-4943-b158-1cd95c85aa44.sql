
-- ============================================================
-- Fase 2B — Service Pricing Audit + Gate + Admin RPCs
-- ============================================================

-- 1) Audit table
CREATE TABLE IF NOT EXISTS public.service_pricing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_pricing_id uuid REFERENCES public.service_pricing(id) ON DELETE SET NULL,
  service_key text NOT NULL,
  action text NOT NULL CHECK (action IN (
    'create','version','deactivate','reactivate',
    'approve_for_live','revoke_live_approval',
    'update_metadata','update_price_version','seed'
  )),
  before jsonb,
  after jsonb,
  reason text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sp_audit_service_key ON public.service_pricing_audit(service_key, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sp_audit_pricing_id ON public.service_pricing_audit(service_pricing_id);

ALTER TABLE public.service_pricing_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin manage service_pricing_audit" ON public.service_pricing_audit;
CREATE POLICY "Platform admin manage service_pricing_audit"
  ON public.service_pricing_audit
  FOR ALL
  USING (public.is_platform_admin_by_auth())
  WITH CHECK (public.is_platform_admin_by_auth());

-- 2) Gate: re-create reserve_credits_v2 with placeholder/approved_for_live check
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

  -- GATE: placeholder + not approved_for_live → bloquear tenant-paid live
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
END; $function$;

REVOKE EXECUTE ON FUNCTION public.reserve_credits_v2(uuid,uuid,text,jsonb,text,uuid,text,jsonb,integer,boolean) FROM PUBLIC, anon, authenticated;

-- 3) Gate: re-create charge_credits_v2 with same check
CREATE OR REPLACE FUNCTION public.charge_credits_v2(
  p_tenant_id uuid, p_user_id uuid, p_service_key text, p_units jsonb,
  p_idempotency_key text, p_feature text DEFAULT NULL::text, p_job_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT false
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

  SELECT id, balance_after INTO existing FROM public.credit_ledger
    WHERE tenant_id=p_tenant_id AND idempotency_key=p_idempotency_key AND transaction_type='consume' LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true,NULL::text,NULL::text,0, COALESCE(existing.balance_after,0), existing.id; RETURN;
  END IF;

  SELECT * INTO est FROM public.estimate_credits_internal(p_service_key, p_units);
  IF NOT est.success THEN
    RETURN QUERY SELECT false, est.error_code, est.error_message,0,0,NULL::uuid; RETURN;
  END IF;

  -- GATE: placeholder + not approved_for_live → bloquear
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
END; $function$;

REVOKE EXECUTE ON FUNCTION public.charge_credits_v2(uuid,uuid,text,jsonb,text,text,uuid,jsonb,boolean) FROM PUBLIC, anon, authenticated;

-- 4) Admin RPCs for catalog management
-- 4.1 create
CREATE OR REPLACE FUNCTION public.admin_pricing_create(
  p_payload jsonb,
  p_reason text
) RETURNS TABLE(success boolean, error_code text, error_message text, pricing_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_uid uuid;
BEGIN
  IF NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',NULL::uuid; RETURN;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN QUERY SELECT false,'reason_required','Motivo obrigatório',NULL::uuid; RETURN;
  END IF;
  v_uid := auth.uid();

  INSERT INTO public.service_pricing(
    service_key, category, display_name, provider, model, unit,
    cost_usd, markup_pct, min_credits_charge, metadata,
    effective_from, effective_until, is_active
  ) VALUES (
    p_payload->>'service_key',
    p_payload->>'category',
    p_payload->>'display_name',
    p_payload->>'provider',
    NULLIF(p_payload->>'model',''),
    p_payload->>'unit',
    (p_payload->>'cost_usd')::numeric,
    COALESCE((p_payload->>'markup_pct')::numeric, 50),
    NULLIF(p_payload->>'min_credits_charge','')::int,
    COALESCE(p_payload->'metadata','{}'::jsonb),
    COALESCE((p_payload->>'effective_from')::timestamptz, now()),
    NULLIF(p_payload->>'effective_until','')::timestamptz,
    COALESCE((p_payload->>'is_active')::boolean, true)
  ) RETURNING id INTO v_id;

  INSERT INTO public.service_pricing_audit(service_pricing_id, service_key, action, before, after, reason, changed_by)
    VALUES (v_id, p_payload->>'service_key', 'create', NULL, p_payload, p_reason, v_uid);

  RETURN QUERY SELECT true, NULL::text, NULL::text, v_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_pricing_create(jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_create(jsonb,text) TO authenticated;

-- 4.2 version (close current, insert new)
CREATE OR REPLACE FUNCTION public.admin_pricing_version(
  p_current_id uuid,
  p_payload jsonb,
  p_reason text
) RETURNS TABLE(success boolean, error_code text, error_message text, new_pricing_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_old RECORD; v_new uuid; v_uid uuid;
BEGIN
  IF NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',NULL::uuid; RETURN;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN QUERY SELECT false,'reason_required','Motivo obrigatório',NULL::uuid; RETURN;
  END IF;
  v_uid := auth.uid();

  SELECT * INTO v_old FROM public.service_pricing WHERE id = p_current_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false,'not_found','Preço não encontrado',NULL::uuid; RETURN;
  END IF;

  -- close current
  UPDATE public.service_pricing
    SET effective_until = now(), is_active = false, updated_at = now()
    WHERE id = p_current_id AND effective_until IS NULL;

  INSERT INTO public.service_pricing_audit(service_pricing_id, service_key, action, before, after, reason, changed_by)
    VALUES (p_current_id, v_old.service_key, 'update_price_version', to_jsonb(v_old), NULL, p_reason, v_uid);

  -- insert new (carrying over fields if not provided)
  INSERT INTO public.service_pricing(
    service_key, category, display_name, provider, model, unit,
    cost_usd, markup_pct, min_credits_charge, metadata,
    effective_from, effective_until, is_active
  ) VALUES (
    v_old.service_key,
    COALESCE(p_payload->>'category', v_old.category),
    COALESCE(p_payload->>'display_name', v_old.display_name),
    COALESCE(p_payload->>'provider', v_old.provider),
    COALESCE(NULLIF(p_payload->>'model',''), v_old.model),
    COALESCE(p_payload->>'unit', v_old.unit),
    COALESCE((p_payload->>'cost_usd')::numeric, v_old.cost_usd),
    COALESCE((p_payload->>'markup_pct')::numeric, v_old.markup_pct),
    COALESCE(NULLIF(p_payload->>'min_credits_charge','')::int, v_old.min_credits_charge),
    COALESCE(p_payload->'metadata', v_old.metadata),
    now(), NULL, true
  ) RETURNING id INTO v_new;

  INSERT INTO public.service_pricing_audit(service_pricing_id, service_key, action, before, after, reason, changed_by)
    VALUES (v_new, v_old.service_key, 'version', to_jsonb(v_old), p_payload, p_reason, v_uid);

  RETURN QUERY SELECT true, NULL::text, NULL::text, v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_pricing_version(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_version(uuid,jsonb,text) TO authenticated;

-- 4.3 set active
CREATE OR REPLACE FUNCTION public.admin_pricing_set_active(
  p_id uuid, p_active boolean, p_reason text
) RETURNS TABLE(success boolean, error_code text, error_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_old RECORD; v_uid uuid;
BEGIN
  IF NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado'; RETURN;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN QUERY SELECT false,'reason_required','Motivo obrigatório'; RETURN;
  END IF;
  v_uid := auth.uid();

  SELECT * INTO v_old FROM public.service_pricing WHERE id=p_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false,'not_found','Preço não encontrado'; RETURN; END IF;

  -- reactivation only allowed if no later version is active for same service_key
  IF p_active AND EXISTS (
    SELECT 1 FROM public.service_pricing
     WHERE service_key=v_old.service_key AND id<>p_id
       AND effective_until IS NULL AND is_active=true
  ) THEN
    RETURN QUERY SELECT false,'newer_active_exists','Já existe uma versão ativa mais recente.'; RETURN;
  END IF;

  UPDATE public.service_pricing SET is_active = p_active, updated_at=now() WHERE id=p_id;

  INSERT INTO public.service_pricing_audit(service_pricing_id, service_key, action, before, after, reason, changed_by)
    VALUES (p_id, v_old.service_key, CASE WHEN p_active THEN 'reactivate' ELSE 'deactivate' END,
            to_jsonb(v_old),
            jsonb_build_object('is_active', p_active),
            p_reason, v_uid);

  RETURN QUERY SELECT true, NULL::text, NULL::text;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_pricing_set_active(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_set_active(uuid,boolean,text) TO authenticated;

-- 4.4 set live approval (block if placeholder & price_source = 'manual_placeholder')
CREATE OR REPLACE FUNCTION public.admin_pricing_set_live_approval(
  p_id uuid, p_approved boolean, p_reason text
) RETURNS TABLE(success boolean, error_code text, error_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_old RECORD; v_uid uuid; v_new_meta jsonb;
BEGIN
  IF NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado'; RETURN;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN QUERY SELECT false,'reason_required','Motivo obrigatório'; RETURN;
  END IF;
  v_uid := auth.uid();

  SELECT * INTO v_old FROM public.service_pricing WHERE id=p_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false,'not_found','Preço não encontrado'; RETURN; END IF;

  IF p_approved
     AND COALESCE((v_old.metadata->>'placeholder')::boolean,false)
     AND COALESCE(v_old.metadata->>'price_source','') = 'manual_placeholder' THEN
    RETURN QUERY SELECT false,'price_source_unverified',
      'Não é possível aprovar para live: preço placeholder sem fonte real validada.';
    RETURN;
  END IF;

  v_new_meta := COALESCE(v_old.metadata,'{}'::jsonb)
                || jsonb_build_object('approved_for_live', p_approved);
  IF p_approved THEN
    v_new_meta := v_new_meta - 'live_block_reason';
  ELSE
    v_new_meta := v_new_meta || jsonb_build_object('live_block_reason','revoked_by_admin');
  END IF;

  UPDATE public.service_pricing SET metadata = v_new_meta, updated_at=now() WHERE id=p_id;

  INSERT INTO public.service_pricing_audit(service_pricing_id, service_key, action, before, after, reason, changed_by)
    VALUES (p_id, v_old.service_key,
            CASE WHEN p_approved THEN 'approve_for_live' ELSE 'revoke_live_approval' END,
            to_jsonb(v_old),
            jsonb_build_object('metadata', v_new_meta),
            p_reason, v_uid);

  RETURN QUERY SELECT true, NULL::text, NULL::text;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_pricing_set_live_approval(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_set_live_approval(uuid,boolean,text) TO authenticated;

-- 4.5 history reader
CREATE OR REPLACE FUNCTION public.admin_pricing_history(p_service_key text)
RETURNS TABLE(
  id uuid, service_key text, action text, before jsonb, after jsonb,
  reason text, changed_by uuid, changed_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, service_key, action, before, after, reason, changed_by, changed_at
    FROM public.service_pricing_audit
   WHERE service_key = p_service_key
     AND public.is_platform_admin_by_auth()
   ORDER BY changed_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_pricing_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_history(text) TO authenticated;
