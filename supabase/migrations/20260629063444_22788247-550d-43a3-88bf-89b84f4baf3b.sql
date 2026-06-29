-- Agenda cron de reconciliação fiscal: seg-sex, 8h-16h BRT (11h-18h UTC), de hora em hora
-- Usa o gate cron_call_edge_if_active para rodar apenas quando há lojista com fiscal ativo
SELECT cron.schedule(
  'fiscal-reconcile-authorized-hourly-business-hours',
  '0 11-18 * * 1-5',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['fiscal']::text[],
    'fiscal-reconcile-authorized-hourly-business-hours',
    'fiscal-reconcile-authorized',
    '{}'::jsonb
  );
  $$
);