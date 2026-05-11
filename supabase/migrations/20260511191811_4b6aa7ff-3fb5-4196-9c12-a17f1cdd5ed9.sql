-- F2.13.2.C — Limpeza retroativa e TTL prospectivo de raw_payload
-- cleanup_cutoff = now() - 7 days; ttl_cutoff = now() - 30 days

-- 1) Limpeza imediata: NULL em raw_payload para mensagens > 7 dias
UPDATE public.whatsapp_inbound_messages
SET raw_payload = NULL
WHERE timestamp < (now() - interval '7 days')
  AND raw_payload IS NOT NULL;

-- 2) TTL prospectivo: cron diário 03:15 BRT (06:15 UTC)
SELECT cron.schedule(
  'cleanup_whatsapp_inbound_raw_payload_30d',
  '15 6 * * *',
  $$
    UPDATE public.whatsapp_inbound_messages
    SET raw_payload = NULL
    WHERE timestamp < (now() - interval '30 days')
      AND raw_payload IS NOT NULL;
  $$
);