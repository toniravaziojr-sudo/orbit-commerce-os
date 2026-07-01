
-- Remove cron antigo com Authorization quebrado
SELECT cron.unschedule('meli-token-refresh-30min');
SELECT cron.unschedule('meli-orders-reconcile-15m');

-- Reagenda usando helper padrão do sistema
SELECT cron.schedule(
  'meli-token-refresh-30min',
  '*/30 * * * *',
  $$SELECT public.cron_call_edge_if_active(
      ARRAY['mercadolivre']::text[],
      'meli-token-refresh-30min',
      'meli-token-refresh',
      '{"refreshAll": true}'::jsonb
    );$$
);

SELECT cron.schedule(
  'meli-orders-reconcile-15m',
  '*/15 * * * *',
  $$SELECT public.cron_call_edge_if_active(
      ARRAY['mercadolivre']::text[],
      'meli-orders-reconcile-15m',
      'meli-orders-reconcile',
      '{}'::jsonb
    );$$
);
