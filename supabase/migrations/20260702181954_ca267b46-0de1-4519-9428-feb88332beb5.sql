SELECT cron.unschedule('meli-token-refresh-30min');
SELECT cron.unschedule('meli-orders-reconcile-15m');
SELECT cron.unschedule('meli-sync-listings-auto');

SELECT cron.schedule(
  'meli-token-refresh-30min',
  '*/30 * * * *',
  $$SELECT public.cron_call_edge_if_active(
      ARRAY['mercado_livre']::text[],
      'meli-token-refresh-30min',
      'meli-token-refresh',
      '{"refreshAll": true}'::jsonb
    );$$
);

SELECT cron.schedule(
  'meli-orders-reconcile-15m',
  '*/15 * * * *',
  $$SELECT public.cron_call_edge_if_active(
      ARRAY['mercado_livre']::text[],
      'meli-orders-reconcile-15m',
      'meli-orders-reconcile',
      '{}'::jsonb
    );$$
);

SELECT cron.schedule(
  'meli-sync-listings-auto',
  '0 8 * * *',
  $$SELECT public.cron_call_edge_if_active(
      ARRAY['mercado_livre']::text[],
      'meli-sync-listings-auto',
      'meli-sync-listings',
      '{"cronMode": true}'::jsonb
    );$$
);