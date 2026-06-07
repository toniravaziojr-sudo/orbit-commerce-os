-- =====================================================================
-- Ads Autopilot — Subfase A.1: Contrato e Armazenamento de Feedback
-- =====================================================================

-- 1) Catálogo de reason_codes (extensível, versionável via active flag)
CREATE TABLE public.ads_autopilot_feedback_reason_codes (
  code TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('approval','rejection_or_revision')),
  label_pt_br TEXT NOT NULL,
  description TEXT,
  action_scope TEXT[] NOT NULL DEFAULT '{}'::text[],
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ads_autopilot_feedback_reason_codes TO authenticated;
GRANT ALL ON public.ads_autopilot_feedback_reason_codes TO service_role;

ALTER TABLE public.ads_autopilot_feedback_reason_codes ENABLE ROW LEVEL SECURITY;

-- Catálogo é global, somente leitura para usuários autenticados
CREATE POLICY "Authenticated users can read reason code catalog"
  ON public.ads_autopilot_feedback_reason_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_aafrc_category_active
  ON public.ads_autopilot_feedback_reason_codes(category, active, sort_order);

-- 2) Histórico de feedback humano
CREATE TABLE public.ads_autopilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Vínculos com sugestão original (weak refs; snapshot abaixo preserva contexto)
  recommendation_id UUID,
  suggestion_group_id UUID,
  action_id UUID,

  -- Snapshot de canal/conta/campanha
  sales_platform TEXT,
  ads_platform TEXT NOT NULL,
  ad_account_id TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  objective TEXT,
  functional_state TEXT,
  proposed_verdict TEXT,
  action_type TEXT,
  action_class TEXT,

  -- Snapshots imutáveis do momento da decisão
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_check_result JSONB,
  observation TEXT,

  -- Decisão
  decision TEXT NOT NULL CHECK (decision IN (
    'approved','rejected','needs_revision','edited_then_approved'
  )),
  reason_codes TEXT[] NOT NULL,
  reason_text TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],

  -- Sinais auxiliares
  user_confidence TEXT CHECK (user_confidence IS NULL OR user_confidence IN ('low','medium','high')),
  would_do_manually BOOLEAN,
  should_become_preference BOOLEAN,
  ignored_context BOOLEAN,
  ignored_context_text TEXT,

  -- Diff (apenas para edited_then_approved)
  diff JSONB,

  -- Auditoria
  decided_by UUID,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT aaf_reason_codes_not_empty CHECK (array_length(reason_codes, 1) >= 1)
);

GRANT SELECT, INSERT ON public.ads_autopilot_feedback TO authenticated;
GRANT ALL ON public.ads_autopilot_feedback TO service_role;

ALTER TABLE public.ads_autopilot_feedback ENABLE ROW LEVEL SECURITY;

-- Isolamento estrito por tenant
CREATE POLICY "Users can view own tenant ads feedback"
  ON public.ads_autopilot_feedback FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant ads feedback"
  ON public.ads_autopilot_feedback FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- Feedback é imutável: sem UPDATE/DELETE para usuários
-- (service_role pode operar para manutenção administrativa via GRANT ALL)

CREATE INDEX idx_aaf_tenant_decided_at
  ON public.ads_autopilot_feedback(tenant_id, decided_at DESC);
CREATE INDEX idx_aaf_tenant_campaign
  ON public.ads_autopilot_feedback(tenant_id, campaign_id);
CREATE INDEX idx_aaf_tenant_action_type
  ON public.ads_autopilot_feedback(tenant_id, action_type);
CREATE INDEX idx_aaf_recommendation
  ON public.ads_autopilot_feedback(recommendation_id);
CREATE INDEX idx_aaf_suggestion_group
  ON public.ads_autopilot_feedback(suggestion_group_id);
CREATE INDEX idx_aaf_reason_codes_gin
  ON public.ads_autopilot_feedback USING GIN (reason_codes);

-- 3) Validador de reason_codes (trigger): rejeita códigos fora do catálogo ou inativos
CREATE OR REPLACE FUNCTION public.validate_ads_autopilot_feedback_reason_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalid TEXT[];
BEGIN
  IF NEW.reason_codes IS NULL OR array_length(NEW.reason_codes, 1) IS NULL THEN
    RAISE EXCEPTION 'reason_codes_required'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(c), ARRAY[]::text[])
    INTO v_invalid
    FROM unnest(NEW.reason_codes) AS c
   WHERE c NOT IN (
     SELECT code FROM public.ads_autopilot_feedback_reason_codes WHERE active = true
   );

  IF array_length(v_invalid, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_reason_codes: %', v_invalid
      USING ERRCODE = '22023';
  END IF;

  -- diff só faz sentido para edited_then_approved
  IF NEW.decision <> 'edited_then_approved' AND NEW.diff IS NOT NULL THEN
    RAISE EXCEPTION 'diff_only_allowed_for_edited_then_approved'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ads_autopilot_feedback_reason_codes
BEFORE INSERT OR UPDATE OF reason_codes, decision, diff
ON public.ads_autopilot_feedback
FOR EACH ROW
EXECUTE FUNCTION public.validate_ads_autopilot_feedback_reason_codes();

-- 4) Trigger de updated_at para o catálogo
CREATE OR REPLACE FUNCTION public.update_aafrc_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aafrc_updated_at
BEFORE UPDATE ON public.ads_autopilot_feedback_reason_codes
FOR EACH ROW EXECUTE FUNCTION public.update_aafrc_updated_at();

COMMENT ON TABLE public.ads_autopilot_feedback IS
  'Histórico imutável de decisões humanas sobre sugestões do Ads Autopilot (Etapa 7.mem — Subfase A.1). Não influencia a IA nesta fase.';
COMMENT ON TABLE public.ads_autopilot_feedback_reason_codes IS
  'Catálogo extensível de motivos para feedback humano sobre sugestões do Ads Autopilot.';