-- Agendar cron diário de reconciliação de snapshots da IA
-- 06:00 UTC = 03:00 BRT (fora do horário comercial)
SELECT cron.schedule(
  'ai-daily-snapshot-reconciliation',
  '0 6 * * *',
  $$SELECT public.ai_daily_snapshot_reconciliation();$$
);