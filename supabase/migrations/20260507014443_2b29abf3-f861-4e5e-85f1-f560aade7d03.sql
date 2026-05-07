CREATE OR REPLACE FUNCTION public.record_platform_cost(
  p_service_key text,
  p_units jsonb,
  p_cost_usd numeric,
  p_origin text,
  p_origin_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, error_code text, error_message text, ledger_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fx RECORD;
  p RECORD;
  v_id uuid;
  pricing_missing boolean := false;
  v_metadata jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false, 'forbidden', 'Acesso negado', NULL::uuid;
    RETURN;
  END IF;

  -- Idempotência: se já existe linha com a mesma chave, retorna o id existente
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
      FROM public.platform_cost_ledger
     WHERE idempotency_key = p_idempotency_key
     LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT true, NULL::text, NULL::text, v_id;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO p FROM public._get_active_pricing(p_service_key);
  IF p.id IS NULL THEN
    pricing_missing := true;
  END IF;

  SELECT * INTO fx FROM public._get_active_fx('USD','BRL');

  -- Compor metadata preservando pricing_id/origin_id (não há colunas dedicadas)
  v_metadata := jsonb_build_object(
    'pricing_missing', pricing_missing,
    'pricing_id', p.id,
    'origin_id', p_origin_id
  ) || COALESCE(p_metadata, '{}'::jsonb);

  INSERT INTO public.platform_cost_ledger(
    service_key, category, provider, units_json, cost_usd, cost_brl,
    fx_rate_usd_brl, fx_source, reason, origin_function, idempotency_key, metadata
  ) VALUES (
    p_service_key,
    COALESCE(p.category, 'platform'),
    COALESCE(p.provider, 'unknown'),
    p_units,
    p_cost_usd,
    p_cost_usd * COALESCE(fx.rate, 0),
    fx.rate,
    COALESCE(fx.source, 'fx_rates'),
    'platform_absorbed_cost',
    p_origin,
    p_idempotency_key,
    v_metadata
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT true, NULL::text, NULL::text, v_id;
END;
$function$;