
-- =========================================================
-- FASE 1: FUNDAÇÃO DO MOTOR UNIVERSAL DE CRÉDITOS
-- =========================================================

-- 1) service_pricing (catálogo universal admin-only)
CREATE TABLE IF NOT EXISTS public.service_pricing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key     text NOT NULL,
  category        text NOT NULL CHECK (category IN (
    'ai_text','ai_image','ai_video','ai_audio','embedding',
    'fiscal','email','whatsapp','scrape','other'
  )),
  display_name    text NOT NULL,
  provider        text NOT NULL,
  model           text,
  unit            text NOT NULL,
  cost_usd        numeric(18,8) NOT NULL CHECK (cost_usd >= 0),
  markup_pct      numeric(6,2) NOT NULL DEFAULT 50 CHECK (markup_pct >= 0),
  min_credits_charge integer,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_pricing_lookup
  ON public.service_pricing (service_key, effective_from DESC)
  WHERE effective_until IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_pricing_category
  ON public.service_pricing (category, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS ux_service_pricing_active_key
  ON public.service_pricing (service_key)
  WHERE effective_until IS NULL AND is_active = true;

ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin manage service_pricing"
  ON public.service_pricing
  FOR ALL
  USING (public.is_platform_admin_by_auth())
  WITH CHECK (public.is_platform_admin_by_auth());

-- 2) platform_cost_ledger (custos absorvidos pela plataforma)
CREATE TABLE IF NOT EXISTS public.platform_cost_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key     text NOT NULL,
  category        text NOT NULL,
  provider        text NOT NULL,
  units_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_usd        numeric(18,8) NOT NULL CHECK (cost_usd >= 0),
  fx_rate_usd_brl numeric(10,4) NOT NULL,
  fx_source       text NOT NULL DEFAULT 'manual',
  cost_brl        numeric(14,4) NOT NULL,
  reason          text NOT NULL,
  origin_function text,
  idempotency_key text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pcl_idem
  ON public.platform_cost_ledger (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pcl_created ON public.platform_cost_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcl_service ON public.platform_cost_ledger (service_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcl_category ON public.platform_cost_ledger (category, created_at DESC);

ALTER TABLE public.platform_cost_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin read platform_cost_ledger"
  ON public.platform_cost_ledger
  FOR SELECT
  USING (public.is_platform_admin_by_auth());

-- (sem policy de INSERT/UPDATE/DELETE → apenas service_role escreve via SECURITY DEFINER no futuro)

-- 3) fx_rates (câmbio configurável)
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base           text NOT NULL DEFAULT 'USD',
  quote          text NOT NULL DEFAULT 'BRL',
  rate           numeric(10,4) NOT NULL CHECK (rate > 0),
  source         text NOT NULL DEFAULT 'manual',
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fx_rates_active
  ON public.fx_rates (base, quote, effective_from DESC);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Tenant pode ler taxa atual (não revela custo nem margem; é apenas câmbio público)
CREATE POLICY "Authenticated read fx_rates"
  ON public.fx_rates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admin manage fx_rates"
  ON public.fx_rates
  FOR ALL
  USING (public.is_platform_admin_by_auth())
  WITH CHECK (public.is_platform_admin_by_auth());

INSERT INTO public.fx_rates (base, quote, rate, source)
VALUES ('USD','BRL', 5.5000, 'manual')
ON CONFLICT DO NOTHING;

-- 4) service_usage_events (telemetria)
CREATE TABLE IF NOT EXISTS public.service_usage_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid,
  cost_owner               text NOT NULL CHECK (cost_owner IN ('tenant','platform')),
  service_key              text NOT NULL,
  category                 text NOT NULL,
  provider                 text NOT NULL,
  units_json               jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                   text NOT NULL CHECK (status IN ('estimated','reserved','captured','released','refunded','failed')),
  origin_function          text,
  credit_ledger_id         uuid,
  platform_cost_ledger_id  uuid,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sue_owner_tenant CHECK (
    (cost_owner = 'tenant' AND tenant_id IS NOT NULL)
    OR (cost_owner = 'platform' AND tenant_id IS NULL)
  ),
  CONSTRAINT chk_sue_ledger_owner CHECK (
    (cost_owner = 'tenant' AND platform_cost_ledger_id IS NULL)
    OR (cost_owner = 'platform' AND credit_ledger_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_sue_tenant_created
  ON public.service_usage_events (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sue_platform_created
  ON public.service_usage_events (created_at DESC)
  WHERE cost_owner = 'platform';
CREATE INDEX IF NOT EXISTS idx_sue_service ON public.service_usage_events (service_key, created_at DESC);

ALTER TABLE public.service_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read own usage_events"
  ON public.service_usage_events
  FOR SELECT
  USING (cost_owner = 'tenant' AND tenant_id IS NOT NULL AND public.user_has_tenant_access(tenant_id));

CREATE POLICY "Platform admin read all usage_events"
  ON public.service_usage_events
  FOR SELECT
  USING (public.is_platform_admin_by_auth());

-- 5) credit_ledger evoluído (aditivo)
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS service_key      text,
  ADD COLUMN IF NOT EXISTS category         text,
  ADD COLUMN IF NOT EXISTS pricing_id       uuid,
  ADD COLUMN IF NOT EXISTS markup_pct_snap  numeric(6,2),
  ADD COLUMN IF NOT EXISTS fx_rate_usd_brl  numeric(10,4),
  ADD COLUMN IF NOT EXISTS fx_source        text,
  ADD COLUMN IF NOT EXISTS cost_brl         numeric(14,4),
  ADD COLUMN IF NOT EXISTS sell_brl         numeric(14,4),
  ADD COLUMN IF NOT EXISTS balance_before   integer,
  ADD COLUMN IF NOT EXISTS balance_after    integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credit_ledger_idempotency_key_key'
      AND conrelid = 'public.credit_ledger'::regclass
  ) THEN
    ALTER TABLE public.credit_ledger
      DROP CONSTRAINT credit_ledger_idempotency_key_key;
  END IF;
END$$;

DROP INDEX IF EXISTS public.idx_credit_ledger_idempotency;

CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_ledger_tenant_idem
  ON public.credit_ledger (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant_created
  ON public.credit_ledger (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_category
  ON public.credit_ledger (tenant_id, category, created_at DESC)
  WHERE category IS NOT NULL;

-- FK opcional para service_pricing
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT fk_credit_ledger_pricing
  FOREIGN KEY (pricing_id) REFERENCES public.service_pricing(id) ON DELETE SET NULL;

-- 6) Hardening de RLS em ai_pricing e ai_model_pricing (remove leitura pública)
DROP POLICY IF EXISTS "Public read ai_pricing" ON public.ai_pricing;
DROP POLICY IF EXISTS "Anyone can view pricing" ON public.ai_model_pricing;

CREATE POLICY "Platform admin read ai_pricing"
  ON public.ai_pricing
  FOR SELECT
  USING (public.is_platform_admin_by_auth());

CREATE POLICY "Platform admin read ai_model_pricing"
  ON public.ai_model_pricing
  FOR SELECT
  USING (public.is_platform_admin());

-- 7) Hardening de credit_wallet: tenant não pode mutar diretamente
DROP POLICY IF EXISTS "System manage wallets" ON public.credit_wallet;

CREATE POLICY "Platform admin manage wallets"
  ON public.credit_wallet
  FOR ALL
  USING (public.is_platform_admin_by_auth())
  WITH CHECK (public.is_platform_admin_by_auth());

-- (mutações operacionais continuam por SECURITY DEFINER nas RPCs v1)

-- 8) View sanitizada para o tenant (extrato sem custo/markup/margem)
CREATE OR REPLACE VIEW public.credit_ledger_tenant_view
WITH (security_invoker = true)
AS
SELECT
  id,
  tenant_id,
  user_id,
  transaction_type,
  category,
  provider,
  model,
  feature,
  units_json,
  credits_delta,
  balance_after,
  sell_brl,
  description,
  idempotency_key,
  job_id,
  created_at
FROM public.credit_ledger;

GRANT SELECT ON public.credit_ledger_tenant_view TO authenticated;

-- 9) Backfill ai_pricing → service_pricing (30 linhas)
INSERT INTO public.service_pricing (
  service_key, category, display_name, provider, model, unit,
  cost_usd, markup_pct, metadata, effective_from, is_active
)
SELECT
  -- service_key determinístico
  ap.provider || '.' || ap.model || '.' || ap.pricing_type
    || COALESCE('.' || NULLIF(ap.resolution,''), '')
    || COALESCE('.' || NULLIF(ap.quality,''), '')
    || CASE WHEN ap.has_audio IS NULL THEN '' WHEN ap.has_audio THEN '.audio' ELSE '.noaudio' END
    AS service_key,
  -- categoria
  CASE
    WHEN ap.pricing_type = 'per_image' THEN 'ai_image'
    WHEN ap.pricing_type = 'per_second' THEN 'ai_video'
    WHEN ap.pricing_type = 'per_minute' THEN 'ai_audio'
    WHEN ap.pricing_type = 'per_1m_tokens'
         AND ap.model ILIKE '%embedding%' THEN 'embedding'
    WHEN ap.pricing_type LIKE 'per_1m_tokens%' THEN 'ai_text'
    ELSE 'other'
  END AS category,
  ap.provider || ' / ' || ap.model
    || COALESCE(' (' || ap.resolution || ')', '')
    || COALESCE(' [' || ap.quality || ']', '')
    AS display_name,
  ap.provider,
  ap.model,
  -- unidade
  CASE
    WHEN ap.pricing_type = 'per_image' THEN 'image'
    WHEN ap.pricing_type = 'per_second' THEN 'second'
    WHEN ap.pricing_type = 'per_minute' THEN 'minute'
    WHEN ap.pricing_type = 'per_1m_tokens_in' THEN 'per_1m_tokens_in'
    WHEN ap.pricing_type = 'per_1m_tokens_out' THEN 'per_1m_tokens_out'
    WHEN ap.pricing_type = 'per_1m_tokens_in_cached' THEN 'per_1m_tokens_in_cached'
    WHEN ap.pricing_type = 'per_1m_tokens' THEN 'per_1m_tokens'
    ELSE ap.pricing_type
  END AS unit,
  ap.cost_usd,
  -- markup default por categoria
  CASE
    WHEN ap.pricing_type = 'per_second' THEN 80   -- vídeo
    ELSE 50
  END AS markup_pct,
  jsonb_strip_nulls(jsonb_build_object(
    'pricing_type', ap.pricing_type,
    'resolution',   ap.resolution,
    'quality',      ap.quality,
    'has_audio',    ap.has_audio,
    'source',       'ai_pricing',
    'source_id',    ap.id::text
  )) AS metadata,
  ap.effective_from::timestamptz,
  (ap.effective_until IS NULL) AS is_active
FROM public.ai_pricing ap
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_pricing sp
  WHERE sp.metadata->>'source' = 'ai_pricing'
    AND sp.metadata->>'source_id' = ap.id::text
);

-- 10) Backfill ai_model_pricing → service_pricing (4 linhas)
-- Modelo legado: cost_per_image (per_image) ou cost_per_1k_tokens (per_1k_tokens)
INSERT INTO public.service_pricing (
  service_key, category, display_name, provider, model, unit,
  cost_usd, markup_pct, metadata, effective_from, is_active
)
SELECT
  amp.provider || '.' || amp.model || '.' ||
    CASE WHEN amp.cost_per_image IS NOT NULL THEN 'per_image' ELSE 'per_1k_tokens' END
    AS service_key,
  CASE WHEN amp.cost_per_image IS NOT NULL THEN 'ai_image' ELSE 'ai_text' END AS category,
  amp.provider || ' / ' || amp.model || ' (legacy)' AS display_name,
  amp.provider,
  amp.model,
  CASE WHEN amp.cost_per_image IS NOT NULL THEN 'image' ELSE 'per_1k_tokens' END AS unit,
  COALESCE(amp.cost_per_image, amp.cost_per_1k_tokens) AS cost_usd,
  50 AS markup_pct,
  jsonb_build_object(
    'source',    'ai_model_pricing',
    'source_id', amp.id::text,
    'legacy',    true,
    'deprecated_at_release', 'phase-1'
  ) AS metadata,
  amp.effective_from,
  (amp.effective_until IS NULL) AS is_active
FROM public.ai_model_pricing amp
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_pricing sp
  WHERE sp.metadata->>'source' = 'ai_model_pricing'
    AND sp.metadata->>'source_id' = amp.id::text
);

-- 11) Ajuste mínimo nas RPCs v1: idempotência por (tenant_id, idempotency_key)
-- Mesma assinatura, mesmo retorno. Apenas o filtro interno muda.

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_tenant_id uuid,
  p_credits integer,
  p_idempotency_key text,
  p_job_id uuid DEFAULT NULL::uuid
)
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

  -- Idempotência por tenant + chave
  IF EXISTS (
    SELECT 1 FROM credit_ledger
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN QUERY SELECT true, NULL::TEXT,
      (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
    RETURN;
  END IF;

  SELECT balance_credits - reserved_credits INTO v_available
  FROM credit_wallet
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_available IS NULL OR v_available < p_credits THEN
    RETURN QUERY SELECT false, 'Saldo insuficiente'::TEXT, COALESCE(v_available, 0);
    RETURN;
  END IF;

  UPDATE credit_wallet
  SET reserved_credits = reserved_credits + p_credits,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO credit_ledger (
    tenant_id, transaction_type, credits_delta, idempotency_key, job_id
  ) VALUES (
    p_tenant_id, 'reserve', -p_credits, p_idempotency_key, p_job_id
  );

  RETURN QUERY SELECT true, NULL::TEXT,
    (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id uuid,
  p_user_id uuid,
  p_credits integer,
  p_idempotency_key text,
  p_provider text,
  p_model text,
  p_feature text,
  p_units_json jsonb,
  p_cost_usd numeric,
  p_job_id uuid DEFAULT NULL::uuid,
  p_from_reserve boolean DEFAULT false
)
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

  -- Idempotência por tenant + chave + tipo consume
  IF EXISTS (
    SELECT 1 FROM credit_ledger
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
      AND transaction_type = 'consume'
  ) THEN
    RETURN QUERY SELECT true, NULL::TEXT,
      (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
    RETURN;
  END IF;

  -- Markup v1 mantido (será substituído por catálogo no v2)
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

  INSERT INTO credit_ledger (
    tenant_id, user_id, transaction_type, provider, model, feature,
    units_json, cost_usd, sell_usd, credits_delta, idempotency_key, job_id
  ) VALUES (
    p_tenant_id, p_user_id, 'consume', p_provider, p_model, p_feature,
    p_units_json, p_cost_usd, v_sell_usd, -p_credits, p_idempotency_key, p_job_id
  );

  RETURN QUERY SELECT true, NULL::TEXT,
    (SELECT balance_credits - reserved_credits FROM credit_wallet WHERE tenant_id = p_tenant_id);
END;
$function$;

-- 12) Trigger updated_at em service_pricing
CREATE TRIGGER trg_service_pricing_updated_at
BEFORE UPDATE ON public.service_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
