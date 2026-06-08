
-- Fase C.4: campo de autonomia também no nível global
ALTER TABLE public.ads_autopilot_configs
  ADD COLUMN IF NOT EXISTS autonomy_mode text NOT NULL DEFAULT 'off';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ads_autopilot_configs_autonomy_mode_check'
  ) THEN
    ALTER TABLE public.ads_autopilot_configs
      ADD CONSTRAINT ads_autopilot_configs_autonomy_mode_check
      CHECK (autonomy_mode IN ('off','technical_only'));
  END IF;
END$$;

-- Índice para a rotina diária de expiração da pausa estratégica
CREATE INDEX IF NOT EXISTS idx_aaa_strategic_pause_expire
  ON public.ads_autopilot_actions (approval_expires_at)
  WHERE status = 'pending_approval'
    AND action_type = 'strategic_pause'
    AND approval_expires_at IS NOT NULL;
