SELECT cron.unschedule('meli-sync-listings-auto');
SELECT cron.schedule(
  'meli-sync-listings-auto',
  '0 8 * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['mercadolivre']::text[],
    'meli-sync-listings-auto',
    'meli-sync-listings',
    '{"cronMode": true}'::jsonb
  );
  $$
);