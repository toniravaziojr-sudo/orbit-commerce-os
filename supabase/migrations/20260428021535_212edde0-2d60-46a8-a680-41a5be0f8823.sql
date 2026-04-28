DROP VIEW IF EXISTS public.whatsapp_inbound_orphans_v;

CREATE VIEW public.whatsapp_inbound_orphans_v
WITH (security_invoker = true)
AS
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
  'Mensagens WhatsApp recebidas há mais de 5min sem desfecho registrado (anti-regressão jan/2026 + abr/2026). security_invoker garante respeito ao RLS do usuário.';