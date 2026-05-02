
-- ============================================================
-- Onda 18 — Fase A: Trace estruturado da IA de atendimento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_turn_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid,
  turn_id text,
  stage text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validação leve de stage (não engessa: aceita extensão futura via lista).
CREATE OR REPLACE FUNCTION public.ai_turn_traces_validate_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS NULL OR length(NEW.stage) = 0 OR length(NEW.stage) > 64 THEN
    RAISE EXCEPTION 'ai_turn_traces.stage inválido: %', NEW.stage;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_turn_traces_validate ON public.ai_turn_traces;
CREATE TRIGGER trg_ai_turn_traces_validate
  BEFORE INSERT OR UPDATE ON public.ai_turn_traces
  FOR EACH ROW EXECUTE FUNCTION public.ai_turn_traces_validate_stage();

CREATE INDEX IF NOT EXISTS idx_ai_turn_traces_tenant_created
  ON public.ai_turn_traces (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_turn_traces_conv_created
  ON public.ai_turn_traces (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_turn_traces_turn
  ON public.ai_turn_traces (turn_id);

ALTER TABLE public.ai_turn_traces ENABLE ROW LEVEL SECURITY;

-- Acesso somente via service_role (edge functions).
-- Nenhuma policy para anon/authenticated → bloqueio total por padrão.
-- Service_role bypassa RLS.

COMMENT ON TABLE public.ai_turn_traces IS
  'Trace estruturado da pipeline da IA de atendimento (Onda 18 Fase A). Acesso somente service_role.';
COMMENT ON COLUMN public.ai_turn_traces.stage IS
  'Estágio do trace: turn_input | search_products_input | candidate_set_raw | enriched_partition | probe_v2_decision | final_ranking';
