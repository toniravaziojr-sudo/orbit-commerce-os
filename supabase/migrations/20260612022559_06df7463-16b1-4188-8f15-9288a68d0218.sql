
-- =====================================================================
-- Onda F — Hierarquia Plano→Filhas + Aprendizados da IA do Gestor de Tráfego
-- =====================================================================

-- 1) Colunas de hierarquia em ads_autopilot_actions
ALTER TABLE public.ads_autopilot_actions
  ADD COLUMN IF NOT EXISTS analysis_run_id uuid REFERENCES public.ads_ai_analysis_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_action_index integer;

CREATE INDEX IF NOT EXISTS idx_aaa_analysis_run
  ON public.ads_autopilot_actions(analysis_run_id)
  WHERE analysis_run_id IS NOT NULL;

-- Dedup: para a mesma "ação planejada" do mesmo plano-pai, só pode haver uma
-- filha viva (rejeitadas/substituídas liberam o slot).
CREATE UNIQUE INDEX IF NOT EXISTS idx_aaa_child_dedup_plan_action
  ON public.ads_autopilot_actions(parent_action_id, planned_action_index)
  WHERE parent_action_id IS NOT NULL
    AND planned_action_index IS NOT NULL
    AND status NOT IN ('rejected','superseded','cancelled');

-- 2) Tabela ads_ai_learnings
CREATE TABLE IF NOT EXISTS public.ads_ai_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'outro'
    CHECK (category IN ('produto','publico','orcamento','funil','criativo','copy','oferta','performance','restricao','tracking','outro')),
  status text NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested','active','paused','archived')),
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('approval','rejection','adjustment','manual','system')),
  source_action_id uuid REFERENCES public.ads_autopilot_actions(id) ON DELETE SET NULL,
  source_plan_id uuid REFERENCES public.ads_autopilot_actions(id) ON DELETE SET NULL,
  source_analysis_run_id uuid REFERENCES public.ads_ai_analysis_runs(id) ON DELETE SET NULL,
  source_feedback_id uuid REFERENCES public.ads_autopilot_feedback(id) ON DELETE SET NULL,
  evidence_count integer NOT NULL DEFAULT 1 CHECK (evidence_count >= 0),
  confidence numeric(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  last_used_at timestamptz,
  archived_at timestamptz,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_ai_learnings TO authenticated;
GRANT ALL ON public.ads_ai_learnings TO service_role;

ALTER TABLE public.ads_ai_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_ai_learnings_tenant_select"
  ON public.ads_ai_learnings FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id));

CREATE POLICY "ads_ai_learnings_tenant_insert"
  ON public.ads_ai_learnings FOR INSERT TO authenticated
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "ads_ai_learnings_tenant_update"
  ON public.ads_ai_learnings FOR UPDATE TO authenticated
  USING (user_has_tenant_access(tenant_id))
  WITH CHECK (user_has_tenant_access(tenant_id));

CREATE POLICY "ads_ai_learnings_tenant_delete"
  ON public.ads_ai_learnings FOR DELETE TO authenticated
  USING (user_has_tenant_access(tenant_id));

CREATE INDEX idx_ads_ai_learnings_tenant_status
  ON public.ads_ai_learnings(tenant_id, status);

CREATE INDEX idx_ads_ai_learnings_tenant_category
  ON public.ads_ai_learnings(tenant_id, category);

-- Normaliza texto para dedup (lower + colapsa espaços + remove pontuação simples)
CREATE OR REPLACE FUNCTION public.ads_ai_learnings_norm_title(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(coalesce(t,'')), '[^a-z0-9 ]+', ' ', 'g')
$$;

-- Dedup: mesmo tenant + categoria + título normalizado, ignorando arquivados
CREATE UNIQUE INDEX idx_ads_ai_learnings_dedup
  ON public.ads_ai_learnings(
    tenant_id,
    category,
    public.ads_ai_learnings_norm_title(title)
  )
  WHERE status <> 'archived';

CREATE OR REPLACE FUNCTION public.tg_ads_ai_learnings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ads_ai_learnings_updated_at
  BEFORE UPDATE ON public.ads_ai_learnings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_ads_ai_learnings_updated_at();
