
-- =========================================================
-- D2: Reciclagem automática de leases vencidos (snapshot queue)
-- =========================================================
CREATE OR REPLACE FUNCTION public.reclaim_stale_snapshot_leases()
RETURNS TABLE(reclaimed_id uuid, tenant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.ai_snapshot_regen_queue q
     SET status = 'pending',
         locked_at = NULL,
         locked_by = NULL,
         lease_expires_at = NULL,
         last_error = COALESCE(q.last_error, '') ||
           CASE WHEN q.last_error IS NOT NULL AND q.last_error <> '' THEN ' | ' ELSE '' END ||
           'lease_reclaimed_at=' || now()::text
   WHERE q.status = 'processing'
     AND q.lease_expires_at IS NOT NULL
     AND q.lease_expires_at < now()
  RETURNING q.id, q.tenant_id;
END;
$$;

COMMENT ON FUNCTION public.reclaim_stale_snapshot_leases() IS
  'Devolve para pending qualquer item da fila de snapshot cuja lease já venceu. Idempotente.';

-- =========================================================
-- D3: Retry com backoff em ai_signal_capture_queue
-- =========================================================
ALTER TABLE public.ai_signal_capture_queue
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_signal_capture_ready
  ON public.ai_signal_capture_queue (status, next_retry_at)
  WHERE status = 'pending';

-- Helper: classifica se um erro é transitório
CREATE OR REPLACE FUNCTION public.is_transient_capture_error(_err text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _err IS NOT NULL AND (
    _err ILIKE '%503%' OR
    _err ILIKE '%502%' OR
    _err ILIKE '%504%' OR
    _err ILIKE '%temporarily unavailable%' OR
    _err ILIKE '%timeout%' OR
    _err ILIKE '%timed out%' OR
    _err ILIKE '%ECONNRESET%' OR
    _err ILIKE '%ETIMEDOUT%' OR
    _err ILIKE '%network%' OR
    _err ILIKE '%fetch failed%' OR
    _err ILIKE '%SUPABASE_EDGE_RUNTIME_ERROR%'
  );
$$;

-- Função consumida pelo worker para registrar falha com retry/backoff
CREATE OR REPLACE FUNCTION public.mark_signal_capture_failed(
  _id uuid,
  _error text
)
RETURNS TABLE(final_status text, next_attempt_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.ai_signal_capture_queue%ROWTYPE;
  _is_transient boolean;
  _next_attempts integer;
  _backoff_minutes integer;
  _next_at timestamptz;
  _new_status text;
BEGIN
  SELECT * INTO _row FROM public.ai_signal_capture_queue WHERE id = _id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  _is_transient := public.is_transient_capture_error(_error);
  _next_attempts := COALESCE(_row.attempts, 0) + 1;

  IF _is_transient AND _next_attempts < COALESCE(_row.max_attempts, 5) THEN
    -- backoff exponencial: 2, 4, 8, 16, 32 minutos
    _backoff_minutes := POWER(2, _next_attempts)::integer;
    _next_at := now() + make_interval(mins => _backoff_minutes);
    _new_status := 'pending';
  ELSE
    _next_at := NULL;
    _new_status := 'failed';
  END IF;

  UPDATE public.ai_signal_capture_queue
     SET status = _new_status,
         attempts = _next_attempts,
         last_error = LEFT(_error, 2000),
         next_retry_at = _next_at,
         processed_at = CASE WHEN _new_status = 'failed' THEN now() ELSE NULL END
   WHERE id = _id;

  final_status := _new_status;
  next_attempt_at := _next_at;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.mark_signal_capture_failed(uuid, text) IS
  'Marca um item da fila de captura como falho. Em erro transitório (503/timeout/rede) reagenda com backoff exponencial até max_attempts.';

-- Função one-shot: ressuscitar itens failed que tiveram apenas erro transitório
CREATE OR REPLACE FUNCTION public.revive_transient_failed_captures()
RETURNS TABLE(revived_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.ai_signal_capture_queue q
     SET status = 'pending',
         next_retry_at = now(),
         processed_at = NULL
   WHERE q.status = 'failed'
     AND public.is_transient_capture_error(q.last_error)
     AND COALESCE(q.attempts, 0) < COALESCE(q.max_attempts, 5)
  RETURNING q.id;
END;
$$;
