-- F2.13.2.B2 — Cleanup PII em backlog + TTL 30d para whatsapp_webhook_raw_audit
-- Cutoffs fixos no início da execução
DO $$
DECLARE
  v_cleanup_cutoff timestamptz := now() - interval '7 days';
  v_ttl_cutoff timestamptz := now() - interval '30 days';
  v_updated_count bigint;
BEGIN
  -- Limpeza imediata de PII em registros < cleanup_cutoff
  UPDATE public.whatsapp_webhook_raw_audit
     SET body_preview = NULL,
         headers_json = '{}'::jsonb
   WHERE received_at < v_cleanup_cutoff
     AND (body_preview IS NOT NULL OR headers_json <> '{}'::jsonb);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'F2.13.2.B2: cleanup_cutoff=% ttl_cutoff=% rows_cleaned=%',
    v_cleanup_cutoff, v_ttl_cutoff, v_updated_count;
END $$;

-- TTL diário: apaga linhas inteiras > 30 dias (03:00 BRT = 06:00 UTC)
SELECT cron.schedule(
  'cleanup_whatsapp_webhook_raw_audit_30d',
  '0 6 * * *',
  $$DELETE FROM public.whatsapp_webhook_raw_audit WHERE received_at < now() - interval '30 days';$$
);