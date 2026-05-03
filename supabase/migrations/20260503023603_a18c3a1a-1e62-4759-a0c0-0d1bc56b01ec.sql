-- Fase C — Turn Orchestrator: retry/backoff + dead-letter + watchdog helpers

-- 1) Desliga flag no piloto (religar ao final)
UPDATE public.ai_support_config
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('turn_orchestrator_enabled', false)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

-- 2) Expandir status: incluir 'dead'
ALTER TABLE public.ai_turn_buffers
  DROP CONSTRAINT IF EXISTS ai_turn_buffers_status_check;
ALTER TABLE public.ai_turn_buffers
  ADD CONSTRAINT ai_turn_buffers_status_check
  CHECK (status IN ('open','claimed','processed','aborted','send_failed','dead'));

-- 3) Campos de retry/backoff
ALTER TABLE public.ai_turn_buffers
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

-- Atualizar índice ativo: incluir 'send_failed' já estava; recriar pra clareza
DROP INDEX IF EXISTS ai_turn_buffers_active_per_conv;
CREATE UNIQUE INDEX ai_turn_buffers_active_per_conv
  ON public.ai_turn_buffers (conversation_id)
  WHERE status IN ('open','claimed','send_failed');

-- Índice para watchdog
CREATE INDEX IF NOT EXISTS ai_turn_buffers_watchdog
  ON public.ai_turn_buffers (status, process_after)
  WHERE status IN ('open','claimed','send_failed');

-- 4) Watchdog RPC: lista buffers travados
CREATE OR REPLACE FUNCTION public.get_stuck_turn_buffers(
  p_now timestamptz DEFAULT now(),
  p_claim_stale_seconds integer DEFAULT 90,
  p_max_attempts integer DEFAULT 5,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  tenant_id uuid,
  conversation_id uuid,
  logical_turn_id uuid,
  status text,
  attempts integer,
  process_after timestamptz,
  claimed_at timestamptz,
  last_error text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.tenant_id, b.conversation_id, b.logical_turn_id, b.status,
         b.attempts, b.process_after, b.claimed_at, b.last_error
  FROM public.ai_turn_buffers b
  WHERE b.attempts < p_max_attempts
    AND (
      -- open/expired sem claim
      (b.status = 'open' AND b.process_after <= p_now)
      OR
      -- send_failed pronto p/ retry
      (b.status = 'send_failed'
        AND (b.next_retry_at IS NULL OR b.next_retry_at <= p_now)
        AND b.process_after <= p_now)
      OR
      -- claim abandonado
      (b.status = 'claimed' AND b.claimed_at < p_now - make_interval(secs => p_claim_stale_seconds))
    )
  ORDER BY b.process_after ASC
  LIMIT p_limit;
$$;

-- 5) Marcar exausto como dead
CREATE OR REPLACE FUNCTION public.mark_dead_turn_buffers(
  p_max_attempts integer DEFAULT 5
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.ai_turn_buffers
    SET status = 'dead',
        failed_reason = COALESCE(failed_reason, last_error, 'max_attempts_exceeded'),
        claim_token = NULL,
        claimed_at = NULL
    WHERE status IN ('open','send_failed','claimed')
      AND attempts >= p_max_attempts
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

-- 6) Atualizar fail_turn para gravar next_retry_at com backoff exponencial
CREATE OR REPLACE FUNCTION public.fail_turn(
  p_conversation_id uuid,
  p_logical_turn_id uuid,
  p_claim_token uuid,
  p_bot_message_id uuid,
  p_error text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_backoff_secs integer;
BEGIN
  SELECT attempts INTO v_attempts
  FROM public.ai_turn_buffers
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id
    AND claim_token = p_claim_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('failed', false, 'reason', 'claim_lost');
  END IF;

  -- backoff: 2s, 5s, 15s, 45s, 120s
  v_backoff_secs := CASE COALESCE(v_attempts,1)
    WHEN 1 THEN 2 WHEN 2 THEN 5 WHEN 3 THEN 15 WHEN 4 THEN 45 ELSE 120
  END;

  UPDATE public.ai_turn_buffers
  SET status = 'send_failed',
      bot_message_id = COALESCE(p_bot_message_id, bot_message_id),
      claim_token = NULL,
      claimed_at = NULL,
      last_error = p_error,
      last_attempt_at = now(),
      next_retry_at = now() + make_interval(secs => v_backoff_secs),
      process_after = now() + make_interval(secs => v_backoff_secs)
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id;

  RETURN jsonb_build_object('failed', true, 'next_retry_in_secs', v_backoff_secs);
END;
$$;

REVOKE ALL ON FUNCTION public.get_stuck_turn_buffers(timestamptz,integer,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_dead_turn_buffers(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stuck_turn_buffers(timestamptz,integer,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_dead_turn_buffers(integer) TO service_role;