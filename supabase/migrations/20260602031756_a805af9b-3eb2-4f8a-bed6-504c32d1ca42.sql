-- =========================================================================
-- Fase B: Execution Policy Engine — Fundação estrutural
-- Idempotente. Aditiva. Não altera registros legados.
-- =========================================================================

-- 1) Colunas físicas em ads_autopilot_actions ----------------------------
ALTER TABLE public.ads_autopilot_actions
  ADD COLUMN IF NOT EXISTS scheduled_for              timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at                timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_user_id        uuid,
  ADD COLUMN IF NOT EXISTS approval_expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS action_class               text,
  ADD COLUMN IF NOT EXISTS campaign_class_at_proposal text,
  ADD COLUMN IF NOT EXISTS policy_check_result        jsonb,
  ADD COLUMN IF NOT EXISTS policy_engine_version      text,
  ADD COLUMN IF NOT EXISTS parent_action_id           uuid,
  ADD COLUMN IF NOT EXISTS executed_simulated         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_executed              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key            text;

-- action_day: coluna gerada BRT (imutável, indexável).
-- Em Postgres, `created_at AT TIME ZONE 'America/Sao_Paulo'` converte timestamptz
-- para timestamp local de SP, que é IMMUTABLE — seguro em coluna gerada e índice.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ads_autopilot_actions' AND column_name='action_day'
  ) THEN
    ALTER TABLE public.ads_autopilot_actions
      ADD COLUMN action_day date
      GENERATED ALWAYS AS (((created_at AT TIME ZONE 'America/Sao_Paulo'))::date) STORED;
  END IF;
END $$;

-- FK self para parent_action_id (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ads_autopilot_actions_parent_action_id_fkey'
  ) THEN
    ALTER TABLE public.ads_autopilot_actions
      ADD CONSTRAINT ads_autopilot_actions_parent_action_id_fkey
      FOREIGN KEY (parent_action_id)
      REFERENCES public.ads_autopilot_actions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Índices ---------------------------------------------------------------

-- Runner do scheduled processa SOMENTE policy_engine_version='v1'
CREATE INDEX IF NOT EXISTS idx_aaa_scheduled_runner_v1
  ON public.ads_autopilot_actions (scheduled_for)
  WHERE status = 'scheduled' AND policy_engine_version = 'v1';

-- Idempotência por chave estável (apenas engine v1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_aaa_idempotency_key_v1
  ON public.ads_autopilot_actions (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND policy_engine_version = 'v1';

-- Idempotência diária por (tenant, channel, action_type, action_day, entity_id)
-- Filtrado por policy_engine_version='v1' — não afeta legado
CREATE UNIQUE INDEX IF NOT EXISTS idx_aaa_daily_idem_v1
  ON public.ads_autopilot_actions
     (tenant_id, channel, action_type, action_day, (action_data->>'entity_id'))
  WHERE policy_engine_version = 'v1'
    AND status IN ('approved','scheduled','executed','auto_executed');

-- Lookup por approval_expires_at para TTL sweep (parcial)
CREATE INDEX IF NOT EXISTS idx_aaa_approval_expires
  ON public.ads_autopilot_actions (approval_expires_at)
  WHERE status IN ('approved','scheduled') AND approval_expires_at IS NOT NULL;

-- 3) Cron do scheduled runner (5 min, gate ai_traffic_manager) --------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ads-autopilot-scheduled-runner-5m') THEN
    PERFORM cron.unschedule('ads-autopilot-scheduled-runner-5m');
  END IF;
END $$;

SELECT cron.schedule(
  'ads-autopilot-scheduled-runner-5m',
  '*/5 * * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['ai_traffic_manager'],
    'ads-autopilot-scheduled-runner-5m',
    'ads-autopilot-scheduled-runner',
    '{}'::jsonb
  );
  $$
);

COMMENT ON COLUMN public.ads_autopilot_actions.policy_engine_version IS
  'Versão do Execution Policy Engine (Fase B = v1). Runner do scheduled e índices únicos só atuam em registros com este campo preenchido.';
COMMENT ON COLUMN public.ads_autopilot_actions.action_day IS
  'Dia operacional em BRT (America/Sao_Paulo). Coluna gerada e imutável, usada em índices de idempotência diária.';