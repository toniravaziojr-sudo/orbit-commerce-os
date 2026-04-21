-- ============================================================
-- MEMÓRIA DE APRENDIZADO POR TENANT — FASE 1
-- Separada de ai_memories (fato declarado vs aprendizado inferido)
-- ============================================================

-- ============================================================
-- 1. TABELA: tenant_learning_events (captura bruta)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_learning_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_agent TEXT NOT NULL DEFAULT 'support',
  conversation_id UUID,
  event_type TEXT NOT NULL,
  -- event_type: 'continuity', 'cart_created', 'checkout_generated',
  --             'order_paid', 'handoff_success', 'complaint',
  --             'human_correction_negative', 'human_correction_positive'
  weight INTEGER NOT NULL DEFAULT 1,
  -- weight ponderado: continuity=+1, cart=+5, checkout=+10, order=+25,
  --                   handoff=+8, complaint=-20, correction_neg=-15, correction_pos=+10
  customer_message TEXT,
  ai_response TEXT,
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_learning_events_event_type_check
    CHECK (event_type IN (
      'continuity', 'cart_created', 'checkout_generated',
      'order_paid', 'handoff_success', 'complaint',
      'human_correction_negative', 'human_correction_positive'
    ))
);

CREATE INDEX idx_tle_tenant_processed ON public.tenant_learning_events(tenant_id, processed, created_at DESC);
CREATE INDEX idx_tle_conversation ON public.tenant_learning_events(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_tle_tenant_type_created ON public.tenant_learning_events(tenant_id, event_type, created_at DESC);

ALTER TABLE public.tenant_learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view own events"
  ON public.tenant_learning_events FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Service role manages events"
  ON public.tenant_learning_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. TABELA: tenant_learning_memory (aprendizados consolidados)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenant_learning_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_agent TEXT NOT NULL DEFAULT 'support',
  learning_type TEXT NOT NULL,
  -- learning_type Fase 1: 'faq', 'objection', 'winning_response'
  -- (Fase 2: 'handoff_pattern', 'commercial_recommendation', 'product_intent_link',
  --          'operational_insight', 'human_correction')
  pattern_text TEXT NOT NULL,
  pattern_normalized TEXT NOT NULL, -- lowercase, sem acento, sem pontuação
  response_text TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  success_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- score 0-100 (pode ir negativo temporariamente em casos de penalidade)
  weight_sum INTEGER NOT NULL DEFAULT 0,
  category_sensitivity TEXT NOT NULL DEFAULT 'safe',
  -- 'safe' | 'commercial' | 'sensitive'
  status TEXT NOT NULL DEFAULT 'pending_review',
  -- 'pending_review' | 'active' | 'paused' | 'rejected'
  rejection_reason TEXT,
  source_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- array de {conversation_id, event_id, weight, occurred_at}
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tlm_learning_type_check
    CHECK (learning_type IN (
      'faq', 'objection', 'winning_response',
      'handoff_pattern', 'commercial_recommendation',
      'product_intent_link', 'operational_insight', 'human_correction'
    )),
  CONSTRAINT tlm_status_check
    CHECK (status IN ('pending_review', 'active', 'paused', 'rejected')),
  CONSTRAINT tlm_sensitivity_check
    CHECK (category_sensitivity IN ('safe', 'commercial', 'sensitive')),
  CONSTRAINT tlm_unique_pattern
    UNIQUE (tenant_id, ai_agent, learning_type, pattern_normalized)
);

CREATE INDEX idx_tlm_tenant_status_score ON public.tenant_learning_memory(tenant_id, status, success_score DESC);
CREATE INDEX idx_tlm_tenant_type_active ON public.tenant_learning_memory(tenant_id, learning_type, status) WHERE status = 'active';
CREATE INDEX idx_tlm_pattern_search ON public.tenant_learning_memory USING gin(to_tsvector('portuguese', pattern_normalized));
CREATE INDEX idx_tlm_last_seen ON public.tenant_learning_memory(tenant_id, last_seen_at DESC);

ALTER TABLE public.tenant_learning_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view own learning"
  ON public.tenant_learning_memory FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant owners manage learning"
  ON public.tenant_learning_memory FOR UPDATE
  USING (public.is_tenant_owner(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));

CREATE POLICY "Service role manages learning"
  ON public.tenant_learning_memory FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE TRIGGER trg_tlm_updated_at
  BEFORE UPDATE ON public.tenant_learning_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. FUNÇÃO: guardrails de conteúdo (validação centralizada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_learning_content_safety(
  p_pattern TEXT,
  p_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_combined TEXT;
  v_blocked TEXT[] := ARRAY[]::TEXT[];
BEGIN
  v_combined := LOWER(COALESCE(p_pattern, '') || ' ' || COALESCE(p_response, ''));

  -- Blocklist de conteúdo sensível (preço, claim, política, dados)
  IF v_combined ~ '\m(r\$|reais?|\$|usd|eur)\s*\d' THEN
    v_blocked := array_append(v_blocked, 'price_value');
  END IF;

  IF v_combined ~ '\d+\s*%' THEN
    v_blocked := array_append(v_blocked, 'percentage');
  END IF;

  IF v_combined ~ '\m(garantido|garantia\s+de\s+resultado|100%|cura|curar|milagr|milagre|milagroso|infal[ií]vel)\M' THEN
    v_blocked := array_append(v_blocked, 'claim');
  END IF;

  IF v_combined ~ '\m(prazo\s+de\s+entrega|entrega\s+em\s+\d|\d+\s+dias?\s+[úu]teis|chega\s+em\s+\d)\M' THEN
    v_blocked := array_append(v_blocked, 'delivery_promise');
  END IF;

  IF v_combined ~ '\m(devolu[çc][ãa]o|reembolso|troca|estorno)\M' THEN
    v_blocked := array_append(v_blocked, 'policy_promise');
  END IF;

  IF v_combined ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' THEN
    v_blocked := array_append(v_blocked, 'cpf');
  END IF;

  IF v_combined ~ '\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}' THEN
    v_blocked := array_append(v_blocked, 'cnpj');
  END IF;

  IF v_combined ~ '\(?\d{2}\)?\s?9?\d{4}-?\d{4}' THEN
    v_blocked := array_append(v_blocked, 'phone');
  END IF;

  RETURN jsonb_build_object(
    'safe', array_length(v_blocked, 1) IS NULL,
    'blocked_reasons', v_blocked
  );
END;
$$;

-- ============================================================
-- 4. FUNÇÃO: promoção de aprendizado (com guardrails)
-- ============================================================
CREATE OR REPLACE FUNCTION public.promote_learning_candidate(
  p_learning_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_safety JSONB;
  v_new_status TEXT;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_record
  FROM public.tenant_learning_memory
  WHERE id = p_learning_id;

  IF v_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Guardrail 1: mínimo de evidências
  IF v_record.evidence_count < 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_evidence',
      'evidence_count', v_record.evidence_count
    );
  END IF;

  -- Guardrail 2: validação de conteúdo
  v_safety := public.check_learning_content_safety(
    v_record.pattern_text,
    v_record.response_text
  );

  IF NOT (v_safety->>'safe')::boolean THEN
    UPDATE public.tenant_learning_memory
    SET status = 'rejected',
        rejection_reason = 'content_blocked: ' || (v_safety->'blocked_reasons')::text
    WHERE id = p_learning_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'content_blocked',
      'reasons', v_safety->'blocked_reasons'
    );
  END IF;

  -- Regra de promoção por sensibilidade + score
  -- safe       → score >= 70 → active
  -- commercial → score >= 85 → active (mais rigoroso)
  -- sensitive  → sempre pending_review
  IF v_record.category_sensitivity = 'sensitive' THEN
    v_new_status := 'pending_review';
    v_reason := 'sensitive_requires_review';
  ELSIF v_record.category_sensitivity = 'commercial' AND v_record.success_score >= 85 THEN
    v_new_status := 'active';
    v_reason := 'commercial_high_score';
  ELSIF v_record.category_sensitivity = 'safe' AND v_record.success_score >= 70 THEN
    v_new_status := 'active';
    v_reason := 'safe_threshold_met';
  ELSE
    v_new_status := 'pending_review';
    v_reason := 'score_below_threshold';
  END IF;

  UPDATE public.tenant_learning_memory
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_learning_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_status', v_new_status,
    'reason', v_reason,
    'score', v_record.success_score,
    'sensitivity', v_record.category_sensitivity
  );
END;
$$;

-- ============================================================
-- 5. FUNÇÃO: leitura otimizada para ai-support-chat
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_relevant_tenant_learning(
  p_tenant_id UUID,
  p_query_text TEXT,
  p_ai_agent TEXT DEFAULT 'support',
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  learning_type TEXT,
  pattern_text TEXT,
  response_text TEXT,
  success_score NUMERIC,
  evidence_count INTEGER,
  similarity REAL
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tlm.id,
    tlm.learning_type,
    tlm.pattern_text,
    tlm.response_text,
    tlm.success_score,
    tlm.evidence_count,
    ts_rank(
      to_tsvector('portuguese', tlm.pattern_normalized),
      plainto_tsquery('portuguese', LOWER(COALESCE(p_query_text, '')))
    ) AS similarity
  FROM public.tenant_learning_memory tlm
  WHERE tlm.tenant_id = p_tenant_id
    AND tlm.ai_agent = p_ai_agent
    AND tlm.status = 'active'
    AND to_tsvector('portuguese', tlm.pattern_normalized)
        @@ plainto_tsquery('portuguese', LOWER(COALESCE(p_query_text, '')))
  ORDER BY similarity DESC, tlm.success_score DESC
  LIMIT p_limit;
$$;

-- ============================================================
-- 6. FUNÇÃO: marcar uso de aprendizado (telemetria)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_learning_used(
  p_learning_ids UUID[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tenant_learning_memory
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = ANY(p_learning_ids);
$$;