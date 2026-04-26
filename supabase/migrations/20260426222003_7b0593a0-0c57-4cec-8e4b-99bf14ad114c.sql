-- Função atômica para anexar uma tentativa ao histórico delivery_attempts
-- Usada exclusivamente pela edge function meta-whatsapp-send para garantir
-- que tentativas concorrentes não se sobrescrevam.
CREATE OR REPLACE FUNCTION public.append_delivery_attempt(
  _message_id uuid,
  _attempt jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated jsonb;
BEGIN
  UPDATE public.messages
  SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{delivery_attempts}',
        COALESCE(metadata->'delivery_attempts', '[]'::jsonb) || jsonb_build_array(_attempt),
        true
      ),
      updated_at = now()
  WHERE id = _message_id
  RETURNING metadata->'delivery_attempts' INTO _updated;

  RETURN COALESCE(_updated, '[]'::jsonb);
END;
$$;

-- Acesso: apenas service_role (edge functions). Nunca exposto ao cliente.
REVOKE ALL ON FUNCTION public.append_delivery_attempt(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_delivery_attempt(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.append_delivery_attempt(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.append_delivery_attempt(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.append_delivery_attempt(uuid, jsonb) IS
'Anexa atomicamente uma tentativa de entrega ao messages.metadata.delivery_attempts. Usado por meta-whatsapp-send para registrar retries sem race condition. Cada attempt tem: attempt_n, started_at, ended_at, duration_ms, outcome (failed_transient|delivered|delivered_after_retry|failed_permanent|skipped_in_progress), error_code, error_message, meta_response_status, wamid.';