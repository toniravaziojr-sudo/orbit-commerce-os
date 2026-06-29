SELECT cron.schedule(
  'fiscal-auto-create-drafts-every-10min',
  '*/10 * * * *',
  $$
    SELECT public.cron_call_edge_if_active(
      ARRAY['fiscal']::text[],
      'fiscal-auto-create-drafts-every-10min',
      'fiscal-auto-create-drafts',
      '{"cron_invocation": true}'::jsonb
    );
  $$
);