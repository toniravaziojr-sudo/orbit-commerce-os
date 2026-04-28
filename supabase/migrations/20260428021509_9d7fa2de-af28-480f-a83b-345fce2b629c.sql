-- 1) Índice parcial para acelerar varredura de mensagens pendentes
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_pending
  ON public.whatsapp_inbound_messages (tenant_id, timestamp DESC)
  WHERE processed_at IS NULL;

-- 2) Trigger guard: garante processing_status='received' no INSERT
CREATE OR REPLACE FUNCTION public.whatsapp_inbound_set_default_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.processing_status IS NULL THEN
    NEW.processing_status := 'received';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_inbound_default_status ON public.whatsapp_inbound_messages;
CREATE TRIGGER trg_whatsapp_inbound_default_status
  BEFORE INSERT ON public.whatsapp_inbound_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_inbound_set_default_status();

-- 3) View de órfãs em tempo real (>5min sem desfecho)
CREATE OR REPLACE VIEW public.whatsapp_inbound_orphans_v AS
SELECT
  id,
  tenant_id,
  from_phone,
  to_phone,
  message_type,
  timestamp,
  processing_status,
  processed_by,
  processing_error,
  EXTRACT(EPOCH FROM (NOW() - timestamp))::int AS age_seconds,
  CASE
    WHEN processed_at IS NOT NULL AND processing_status IS NULL
      THEN 'silent_partial_update'
    WHEN processed_at IS NULL AND processing_status = 'received'
      THEN 'never_processed'
    WHEN processed_at IS NULL
      THEN 'unknown_silent'
    WHEN processing_status = 'failed'
      THEN 'explicit_failure'
    ELSE 'other'
  END AS orphan_reason
FROM public.whatsapp_inbound_messages
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND timestamp < NOW() - INTERVAL '5 minutes'
  AND (
    processed_at IS NULL
    OR processing_status IS NULL
    OR processing_status = 'failed'
  );

COMMENT ON VIEW public.whatsapp_inbound_orphans_v IS
  'Mensagens WhatsApp recebidas há mais de 5min sem desfecho registrado (anti-regressão jan/2026 + abr/2026).';

COMMENT ON INDEX public.idx_whatsapp_inbound_pending IS
  'Índice parcial para watcher de órfãs e diagnóstico do pipeline.';