
-- 1) Colunas para shadow/live por service_key
ALTER TABLE public.tenant_credit_motor_config
  ADD COLUMN IF NOT EXISTS shadow_service_keys text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS live_service_keys   text[] NOT NULL DEFAULT '{}'::text[];

-- 2) estimate_credits_internal com suporte a pricing_model='fixed_credits'
CREATE OR REPLACE FUNCTION public.estimate_credits_internal(p_service_key text, p_units jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(success boolean, error_code text, error_message text, credits_estimated integer, cost_usd_snap numeric, sell_usd_snap numeric, sell_brl_snap numeric, fx_rate_snap numeric, pricing_id uuid, markup_pct_snap numeric, category text, service_key text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  fx RECORD;
  q numeric;
  cost numeric;
  sell_usd numeric;
  sell_brl numeric;
  credits int;
  pricing_model text;
  base_credits int;
  thumb_extra int;
  cap_extra int;
  has_thumb boolean;
  has_caps boolean;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_platform_admin_by_auth() THEN
    RETURN QUERY SELECT false,'forbidden','Acesso negado',0,0::numeric,0::numeric,0::numeric,0::numeric,NULL::uuid,0::numeric,NULL::text,p_service_key;
    RETURN;
  END IF;

  -- carregar pricing + metadata
  SELECT sp.id, sp.service_key, sp.category, sp.provider, sp.unit, sp.cost_usd, sp.markup_pct, sp.is_active, sp.metadata
    INTO p
  FROM public.service_pricing sp
  WHERE sp.service_key = p_service_key AND sp.is_active = true
  ORDER BY sp.effective_from DESC NULLS LAST, sp.created_at DESC
  LIMIT 1;

  IF p.id IS NULL THEN
    RETURN QUERY SELECT false,'pricing_not_found','Preço não encontrado para '||p_service_key,0,0::numeric,0::numeric,0::numeric,0::numeric,NULL::uuid,0::numeric,NULL::text,p_service_key;
    RETURN;
  END IF;

  pricing_model := COALESCE(p.metadata->>'pricing_model','cost_plus_markup');

  -- Modelo de créditos fixos (monetização interna, ex.: youtube-upload)
  IF pricing_model = 'fixed_credits' THEN
    base_credits := COALESCE((p.metadata->>'v1_equivalent_base_credits')::int, 1);
    thumb_extra  := COALESCE((p.metadata->>'v1_thumb_extra_credits')::int, 0);
    cap_extra    := COALESCE((p.metadata->>'v1_captions_extra_credits')::int, 0);
    has_thumb    := COALESCE((p_units->>'thumbnail')::boolean, false);
    has_caps     := COALESCE((p_units->>'captions')::boolean, false);
    credits := base_credits
               + CASE WHEN has_thumb THEN thumb_extra ELSE 0 END
               + CASE WHEN has_caps  THEN cap_extra   ELSE 0 END;
    credits := GREATEST(1, credits);
    -- cost/sell_usd/sell_brl não se aplicam financeiramente; retornamos 0 para sinalizar
    RETURN QUERY SELECT true, NULL::text, NULL::text, credits, 0::numeric, 0::numeric, 0::numeric, NULL::numeric, p.id, p.markup_pct, p.category, p.service_key;
    RETURN;
  END IF;

  -- Modelo padrão cost_plus_markup
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
END;
$function$;
