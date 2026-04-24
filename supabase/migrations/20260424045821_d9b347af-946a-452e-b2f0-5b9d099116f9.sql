-- =========================================
-- Sub-fase 1.3: Insights Regenerativos
-- =========================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.ai_insight_type AS ENUM (
    'linguagem',
    'dor',
    'objecao',
    'motivo_nao_fechamento',
    'oportunidade',
    'problema_operacional',
    'tendencia',
    'sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_signal_candidate_status AS ENUM (
    'capturado',
    'agrupado',
    'descartado',
    'virou_insight'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_brain_insight_status AS ENUM (
    'pendente',
    'urgente',
    'ativo',
    'revogado',
    'descartado',
    'expirado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_critical_alert_status AS ENUM (
    'aberto',
    'em_analise',
    'resolvido',
    'falso_positivo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- TABELA: ai_signal_candidates
-- =========================================
CREATE TABLE IF NOT EXISTS public.ai_signal_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID,
  customer_id UUID,
  product_id UUID,
  source_channel TEXT NOT NULL DEFAULT 'whatsapp',
  insight_type public.ai_insight_type NOT NULL,
  raw_text TEXT NOT NULL,
  canonical_concept TEXT,
  canonical_group_id UUID,
  severity TEXT NOT NULL DEFAULT 'normal',
  is_critical BOOLEAN NOT NULL DEFAULT false,
  filter_reason TEXT,
  status public.ai_signal_candidate_status NOT NULL DEFAULT 'capturado',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_signal_candidates_tenant ON public.ai_signal_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_signal_candidates_tenant_captured ON public.ai_signal_candidates(tenant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_signal_candidates_status ON public.ai_signal_candidates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_signal_candidates_canonical_group ON public.ai_signal_candidates(canonical_group_id);
CREATE INDEX IF NOT EXISTS idx_ai_signal_candidates_customer ON public.ai_signal_candidates(tenant_id, customer_id);

ALTER TABLE public.ai_signal_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view signal candidates"
  ON public.ai_signal_candidates FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role manages signal candidates"
  ON public.ai_signal_candidates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- TABELA: ai_signal_canonical_groups
-- =========================================
CREATE TABLE IF NOT EXISTS public.ai_signal_canonical_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  insight_type public.ai_insight_type NOT NULL,
  canonical_label TEXT NOT NULL,
  canonical_summary TEXT,
  variations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  evidence_count INTEGER NOT NULL DEFAULT 0,
  unique_customer_count INTEGER NOT NULL DEFAULT 0,
  product_id UUID,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_canonical_groups_tenant ON public.ai_signal_canonical_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_canonical_groups_type ON public.ai_signal_canonical_groups(tenant_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_canonical_groups_last_seen ON public.ai_signal_canonical_groups(tenant_id, last_seen_at DESC);

ALTER TABLE public.ai_signal_canonical_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view canonical groups"
  ON public.ai_signal_canonical_groups FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role manages canonical groups"
  ON public.ai_signal_canonical_groups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- FK do candidate -> canonical group (depois da criação)
ALTER TABLE public.ai_signal_candidates
  ADD CONSTRAINT ai_signal_candidates_canonical_group_fkey
  FOREIGN KEY (canonical_group_id) REFERENCES public.ai_signal_canonical_groups(id) ON DELETE SET NULL;

-- =========================================
-- TABELA: ai_brain_insights
-- =========================================
CREATE TABLE IF NOT EXISTS public.ai_brain_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  canonical_group_id UUID REFERENCES public.ai_signal_canonical_groups(id) ON DELETE SET NULL,
  insight_type public.ai_insight_type NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendation TEXT,
  evidence_samples JSONB NOT NULL DEFAULT '[]'::jsonb,
  variations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  product_id UUID,
  status public.ai_brain_insight_status NOT NULL DEFAULT 'pendente',
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  -- escopo por agente (toggles)
  scope_vendas BOOLEAN NOT NULL DEFAULT true,
  scope_trafego BOOLEAN NOT NULL DEFAULT true,
  scope_landing BOOLEAN NOT NULL DEFAULT true,
  scope_auxiliar BOOLEAN NOT NULL DEFAULT false,
  -- métricas
  evidence_count INTEGER NOT NULL DEFAULT 0,
  unique_customer_count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  -- ciclo de vida
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  revoked_by UUID,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_brain_insights_tenant ON public.ai_brain_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_brain_insights_status ON public.ai_brain_insights(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_brain_insights_active ON public.ai_brain_insights(tenant_id) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_ai_brain_insights_urgent ON public.ai_brain_insights(tenant_id) WHERE is_urgent = true;
CREATE INDEX IF NOT EXISTS idx_ai_brain_insights_type ON public.ai_brain_insights(tenant_id, insight_type);

ALTER TABLE public.ai_brain_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view brain insights"
  ON public.ai_brain_insights FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant admins can update brain insights"
  ON public.ai_brain_insights FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role manages brain insights"
  ON public.ai_brain_insights FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- TABELA: ai_critical_alerts
-- =========================================
CREATE TABLE IF NOT EXISTS public.ai_critical_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  trigger_text TEXT,
  conversation_id UUID,
  customer_id UUID,
  occurrences_2h INTEGER NOT NULL DEFAULT 1,
  status public.ai_critical_alert_status NOT NULL DEFAULT 'aberto',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_critical_alerts_tenant ON public.ai_critical_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_critical_alerts_open ON public.ai_critical_alerts(tenant_id, detected_at DESC) WHERE status IN ('aberto', 'em_analise');

ALTER TABLE public.ai_critical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view critical alerts"
  ON public.ai_critical_alerts FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant admins can update critical alerts"
  ON public.ai_critical_alerts FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role manages critical alerts"
  ON public.ai_critical_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- TRIGGERS de updated_at
-- =========================================
CREATE TRIGGER trg_ai_canonical_groups_updated
  BEFORE UPDATE ON public.ai_signal_canonical_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_brain_insights_updated
  BEFORE UPDATE ON public.ai_brain_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_critical_alerts_updated
  BEFORE UPDATE ON public.ai_critical_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- FUNÇÃO ADAPTATIVA DE RELEVÂNCIA
-- =========================================
CREATE OR REPLACE FUNCTION public.is_signal_relevant(
  _tenant_id UUID,
  _evidence_count INTEGER,
  _unique_customer_count INTEGER,
  _period_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_conversations INTEGER;
  threshold_count INTEGER;
  threshold_pct NUMERIC;
BEGIN
  -- volume de atendimentos finalizados no período (proxy)
  SELECT COUNT(*) INTO total_conversations
  FROM public.ai_signal_candidates
  WHERE tenant_id = _tenant_id
    AND captured_at >= now() - (_period_days || ' days')::interval;

  -- Escala adaptativa por porte
  IF total_conversations < 50 THEN
    -- micro: mínimo 3 menções de clientes únicos
    threshold_count := 3;
    threshold_pct := 0;
  ELSIF total_conversations < 200 THEN
    -- pequeno: 5 menções OU 5%
    threshold_count := 5;
    threshold_pct := 0.05;
  ELSIF total_conversations < 500 THEN
    -- médio: 8 menções OU 4%
    threshold_count := 8;
    threshold_pct := 0.04;
  ELSIF total_conversations < 2000 THEN
    -- grande: 15 menções OU 3%
    threshold_count := 15;
    threshold_pct := 0.03;
  ELSE
    -- enterprise: 30 menções OU 2%
    threshold_count := 30;
    threshold_pct := 0.02;
  END IF;

  RETURN _unique_customer_count >= threshold_count
     OR (threshold_pct > 0 AND total_conversations > 0
         AND (_unique_customer_count::NUMERIC / total_conversations) >= threshold_pct);
END;
$$;

-- =========================================
-- VIEW: insights ativos prontos para injeção
-- =========================================
CREATE OR REPLACE VIEW public.ai_brain_active_view AS
SELECT
  id,
  tenant_id,
  insight_type,
  title,
  summary,
  recommendation,
  variations,
  product_id,
  scope_vendas,
  scope_trafego,
  scope_landing,
  scope_auxiliar,
  approved_at,
  expires_at
FROM public.ai_brain_insights
WHERE status = 'ativo'
  AND (expires_at IS NULL OR expires_at > now());