-- Frente 4.3 — Versionamento de propostas (ads_autopilot_actions)

-- 1. Nova coluna apontando para a proposta filha que substituiu esta
ALTER TABLE public.ads_autopilot_actions
  ADD COLUMN IF NOT EXISTS superseded_by_action_id uuid
    REFERENCES public.ads_autopilot_actions(id) ON DELETE SET NULL;

-- 2. Índices para histórico/cadeia de versões
CREATE INDEX IF NOT EXISTS idx_aaa_parent_action
  ON public.ads_autopilot_actions(parent_action_id)
  WHERE parent_action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aaa_superseded_by
  ON public.ads_autopilot_actions(superseded_by_action_id)
  WHERE superseded_by_action_id IS NOT NULL;

-- 3. Status `superseded` é texto livre (não há CHECK constraint na coluna).
--    Apenas garantia documental: aceito como valor válido em UI/edge functions.

COMMENT ON COLUMN public.ads_autopilot_actions.superseded_by_action_id IS
  'Frente 4.3 — Aponta para a proposta filha (revisada) que substituiu esta. '
  'Combinado com parent_action_id forma a cadeia de versões v1 → v2 → v3.';
