SELECT cron.schedule(
  'agenda-dispatch-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/agenda-dispatch-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3NlemZqaGR2dm5jc3F5aHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcyMDksImV4cCI6MjA4MTE2MzIwOX0.xijqzFrwy221qrnnwU2PAH7Kk6Qm2AlfXhbk6uEVAVg"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);