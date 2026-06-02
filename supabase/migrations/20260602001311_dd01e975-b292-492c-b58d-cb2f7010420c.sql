-- =========================================================================
-- Cron schedules — Ads Autopilot Guardian + Google Token Refresh
-- =========================================================================
-- IMPORTANT:
--   - Idempotent: unschedule existing jobs with the same name before creating.
--   - No changes to any edge function logic, table, RLS, prompts or business rules.
--   - Guardian cycles are aligned with the function's internal detectCycle()
--     which only accepts BRT hours 00, 12, 13, 16. BRT = UTC-3.
--   - Google token refresh runs every 10 minutes (function refreshes connections
--     expiring in the next 10 minutes).
-- =========================================================================

-- ---------- 1) ads-autopilot-guardian — 4 BRT cycles ----------------------

-- Safety: remove any pre-existing schedules with the same names (idempotency)
DO $$
DECLARE
  v_jobname text;
BEGIN
  FOREACH v_jobname IN ARRAY ARRAY[
    'ads-autopilot-guardian-0001-brt',
    'ads-autopilot-guardian-1200-brt',
    'ads-autopilot-guardian-1300-brt',
    'ads-autopilot-guardian-1600-brt',
    'google-token-refresh-cron-10min'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_jobname) THEN
      PERFORM cron.unschedule(v_jobname);
    END IF;
  END LOOP;
END $$;

-- 00:01 BRT = 03:01 UTC — execute scheduled budget changes + reactivate overnight pauses
SELECT cron.schedule(
  'ads-autopilot-guardian-0001-brt',
  '1 3 * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['ai_traffic_manager'],
    'ads-autopilot-guardian-0001-brt',
    'ads-autopilot-guardian',
    '{"cycle":"00h"}'::jsonb
  );
  $$
);

-- 12:00 BRT = 15:00 UTC — 1st analysis, pause bad performers
SELECT cron.schedule(
  'ads-autopilot-guardian-1200-brt',
  '0 15 * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['ai_traffic_manager'],
    'ads-autopilot-guardian-1200-brt',
    'ads-autopilot-guardian',
    '{"cycle":"12h"}'::jsonb
  );
  $$
);

-- 13:00 BRT = 16:00 UTC — reactivate paused-at-12h for retest
SELECT cron.schedule(
  'ads-autopilot-guardian-1300-brt',
  '0 16 * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['ai_traffic_manager'],
    'ads-autopilot-guardian-1300-brt',
    'ads-autopilot-guardian',
    '{"cycle":"13h"}'::jsonb
  );
  $$
);

-- 16:00 BRT = 19:00 UTC — re-evaluate reactivated; pause until 00:01 if still bad
SELECT cron.schedule(
  'ads-autopilot-guardian-1600-brt',
  '0 19 * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['ai_traffic_manager'],
    'ads-autopilot-guardian-1600-brt',
    'ads-autopilot-guardian',
    '{"cycle":"16h"}'::jsonb
  );
  $$
);

-- ---------- 2) google-token-refresh-cron — every 10 minutes ---------------
-- Google access tokens expire in ~1h; the function refreshes connections
-- whose tokens expire in the next 10 minutes. 10-min cadence is the safe
-- minimum to never miss an expiring token.
-- Feature gate: any tenant with Google Ads or YouTube Publishing tracked.
-- (If other Google scopes/modules become tracked later in
-- system_resource_usage, append them to the array.)

SELECT cron.schedule(
  'google-token-refresh-cron-10min',
  '*/10 * * * *',
  $$
  SELECT public.cron_call_edge_if_active(
    ARRAY['google_ads','youtube_publishing'],
    'google-token-refresh-cron-10min',
    'google-token-refresh-cron',
    '{}'::jsonb
  );
  $$
);