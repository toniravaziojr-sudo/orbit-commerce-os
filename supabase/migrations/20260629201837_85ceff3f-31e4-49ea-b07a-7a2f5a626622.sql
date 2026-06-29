SELECT cron.unschedule('meli-token-refresh-30min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='meli-token-refresh-30min');

SELECT cron.schedule(
  'meli-token-refresh-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/meli-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('refreshAll', true)
  );
  $$
);