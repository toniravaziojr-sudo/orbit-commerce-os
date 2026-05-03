-- ============================================================
-- Fase C — Turn Orchestrator (Reg #2.13)
-- ============================================================

-- 1) Tabela buffer
CREATE TABLE IF NOT EXISTS public.ai_turn_buffers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  logical_turn_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','claimed','processed','aborted','send_failed')),
  claim_token uuid,
  claimed_at timestamptz,
  process_after timestamptz NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  message_ids uuid[] NOT NULL DEFAULT '{}',
  snapshot_message_ids uuid[] NOT NULL DEFAULT '{}',
  completeness text NOT NULL DEFAULT 'incomplete_or_fragmented',
  debounce_ms integer NOT NULL DEFAULT 5000,
  bot_message_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1 buffer ATIVO por conversa (open/claimed/send_failed). Vários processed coexistem.
CREATE UNIQUE INDEX IF NOT EXISTS ai_turn_buffers_active_per_conv
  ON public.ai_turn_buffers (conversation_id)
  WHERE status IN ('open','claimed','send_failed');

CREATE INDEX IF NOT EXISTS ai_turn_buffers_tenant_status_after
  ON public.ai_turn_buffers (tenant_id, status, process_after);

CREATE INDEX IF NOT EXISTS ai_turn_buffers_logical_turn
  ON public.ai_turn_buffers (logical_turn_id);

ALTER TABLE public.ai_turn_buffers ENABLE ROW LEVEL SECURITY;

-- RLS: bloqueia anon e authenticated. Acesso apenas via SECURITY DEFINER RPCs.
CREATE POLICY "ai_turn_buffers no public access"
  ON public.ai_turn_buffers FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_ai_turn_buffers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS ai_turn_buffers_updated_at ON public.ai_turn_buffers;
CREATE TRIGGER ai_turn_buffers_updated_at
  BEFORE UPDATE ON public.ai_turn_buffers
  FOR EACH ROW EXECUTE FUNCTION public.tg_ai_turn_buffers_updated_at();

-- 2) Idempotência forte: 1 resposta bot por logical_turn_id por conversa
CREATE UNIQUE INDEX IF NOT EXISTS messages_unique_bot_per_logical_turn
  ON public.messages (conversation_id, ((metadata->>'logical_turn_id')))
  WHERE sender_type = 'bot' AND metadata ? 'logical_turn_id';

-- 3) RPC: enqueue_turn_message
CREATE OR REPLACE FUNCTION public.enqueue_turn_message(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_message_id uuid,
  p_completeness text,
  p_debounce_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buf public.ai_turn_buffers;
  v_now timestamptz := now();
  v_new_process_after timestamptz;
BEGIN
  SELECT * INTO v_buf
  FROM public.ai_turn_buffers
  WHERE conversation_id = p_conversation_id
    AND status IN ('open','claimed','send_failed')
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.ai_turn_buffers (
      tenant_id, conversation_id, message_ids,
      completeness, debounce_ms, process_after, last_message_at
    ) VALUES (
      p_tenant_id, p_conversation_id, ARRAY[p_message_id],
      p_completeness, p_debounce_ms,
      v_now + make_interval(secs => p_debounce_ms / 1000.0),
      v_now
    )
    RETURNING * INTO v_buf;

    RETURN jsonb_build_object(
      'logical_turn_id', v_buf.logical_turn_id,
      'process_after', v_buf.process_after,
      'completeness', v_buf.completeness,
      'debounce_ms', v_buf.debounce_ms,
      'buffer_size', 1,
      'created', true
    );
  END IF;

  -- Buffer existe. Se já claimed → freshness lida pelo worker; aqui só appenda.
  -- process_after RECALCULADO: sempre = now() + debounce_ms da CLASSIFICAÇÃO ATUAL
  -- (não max). Isso permite ENCURTAR a janela quando turno virou completo.
  v_new_process_after := v_now + make_interval(secs => p_debounce_ms / 1000.0);

  UPDATE public.ai_turn_buffers
  SET message_ids = array_append(message_ids, p_message_id),
      completeness = p_completeness,
      debounce_ms = p_debounce_ms,
      process_after = v_new_process_after,
      last_message_at = v_now,
      -- Se estava claimed, não muda status; freshness check do worker vai detectar.
      status = CASE WHEN status = 'send_failed' THEN 'open' ELSE status END
  WHERE id = v_buf.id;

  RETURN jsonb_build_object(
    'logical_turn_id', v_buf.logical_turn_id,
    'process_after', v_new_process_after,
    'completeness', p_completeness,
    'debounce_ms', p_debounce_ms,
    'buffer_size', array_length(v_buf.message_ids, 1) + 1,
    'created', false,
    'was_claimed', v_buf.status = 'claimed'
  );
END;
$$;

-- 4) RPC: claim_turn
CREATE OR REPLACE FUNCTION public.claim_turn(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_logical_turn_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buf public.ai_turn_buffers;
  v_now timestamptz := now();
  v_token uuid := gen_random_uuid();
  v_wait_ms integer;
BEGIN
  SELECT * INTO v_buf
  FROM public.ai_turn_buffers
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'buffer_not_found');
  END IF;

  IF v_buf.status = 'processed' THEN
    RETURN jsonb_build_object('already_processed', true);
  END IF;

  -- Claim stale (>90s) é considerado abandonado
  IF v_buf.status = 'claimed' AND v_buf.claimed_at > v_now - interval '90 seconds' THEN
    RETURN jsonb_build_object('already_claimed', true,
                              'claim_token', v_buf.claim_token);
  END IF;

  IF v_now < v_buf.process_after THEN
    v_wait_ms := EXTRACT(EPOCH FROM (v_buf.process_after - v_now)) * 1000;
    RETURN jsonb_build_object(
      'wait_ms', v_wait_ms,
      'process_after', v_buf.process_after
    );
  END IF;

  UPDATE public.ai_turn_buffers
  SET status = 'claimed',
      claim_token = v_token,
      claimed_at = v_now,
      snapshot_message_ids = message_ids,
      attempts = attempts + 1
  WHERE id = v_buf.id;

  RETURN jsonb_build_object(
    'claim_token', v_token,
    'snapshot_message_ids', v_buf.message_ids,
    'completeness', v_buf.completeness,
    'attempts', v_buf.attempts + 1
  );
END;
$$;

-- 5) RPC: check_turn_freshness
CREATE OR REPLACE FUNCTION public.check_turn_freshness(
  p_conversation_id uuid,
  p_logical_turn_id uuid,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buf public.ai_turn_buffers;
  v_new_msgs uuid[];
BEGIN
  SELECT * INTO v_buf
  FROM public.ai_turn_buffers
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('fresh', false, 'reason', 'buffer_missing');
  END IF;

  IF v_buf.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN jsonb_build_object('fresh', false, 'reason', 'claim_lost');
  END IF;

  -- Diferença entre message_ids atual e snapshot
  SELECT array_agg(m) INTO v_new_msgs
  FROM unnest(v_buf.message_ids) m
  WHERE m <> ALL(v_buf.snapshot_message_ids);

  IF v_new_msgs IS NOT NULL AND array_length(v_new_msgs, 1) > 0 THEN
    RETURN jsonb_build_object(
      'fresh', false,
      'reason', 'new_messages',
      'new_message_ids', v_new_msgs
    );
  END IF;

  RETURN jsonb_build_object('fresh', true);
END;
$$;

-- 6) RPC: reopen_turn (libera claim para reprocessamento)
CREATE OR REPLACE FUNCTION public.reopen_turn(
  p_conversation_id uuid,
  p_logical_turn_id uuid,
  p_claim_token uuid,
  p_extend_ms integer DEFAULT 1500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  UPDATE public.ai_turn_buffers
  SET status = 'open',
      claim_token = NULL,
      claimed_at = NULL,
      snapshot_message_ids = '{}',
      process_after = GREATEST(process_after, v_now + make_interval(secs => p_extend_ms / 1000.0))
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id
    AND claim_token = p_claim_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reopened', false, 'reason', 'claim_lost_or_buffer_missing');
  END IF;

  RETURN jsonb_build_object('reopened', true);
END;
$$;

-- 7) RPC: complete_turn (após envio OK)
CREATE OR REPLACE FUNCTION public.complete_turn(
  p_conversation_id uuid,
  p_logical_turn_id uuid,
  p_claim_token uuid,
  p_bot_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_turn_buffers
  SET status = 'processed',
      bot_message_id = p_bot_message_id,
      last_error = NULL
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id
    AND claim_token = p_claim_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'claim_lost');
  END IF;

  RETURN jsonb_build_object('completed', true);
END;
$$;

-- 8) RPC: fail_turn (envio falhou — permite retry idempotente)
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
BEGIN
  -- Status send_failed: bot_message_id preservado, claim limpo, retry pode pegar
  UPDATE public.ai_turn_buffers
  SET status = 'send_failed',
      bot_message_id = COALESCE(p_bot_message_id, bot_message_id),
      claim_token = NULL,
      claimed_at = NULL,
      last_error = p_error,
      process_after = now() + interval '2 seconds'
  WHERE conversation_id = p_conversation_id
    AND logical_turn_id = p_logical_turn_id
    AND claim_token = p_claim_token;

  RETURN jsonb_build_object('failed', FOUND);
END;
$$;

-- 9) Permissões: somente service_role pode chamar as RPCs
REVOKE ALL ON FUNCTION public.enqueue_turn_message(uuid,uuid,uuid,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_turn(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_turn_freshness(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reopen_turn(uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_turn(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_turn(uuid,uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_turn_message(uuid,uuid,uuid,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_turn(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_turn_freshness(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reopen_turn(uuid,uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_turn(uuid,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_turn(uuid,uuid,uuid,uuid,text) TO service_role;

-- 10) Flag de ativação (default false; piloto Respeite o Homem ativa via UPDATE separado)
UPDATE public.ai_support_config
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('turn_orchestrator_enabled', true)
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';