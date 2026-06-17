DO $$
DECLARE t uuid := 'd1a4d0ed-8842-495e-b741-540a9a345b25';
BEGIN
  DELETE FROM ads_autopilot_feedback WHERE tenant_id = t;
  DELETE FROM ads_autopilot_actions WHERE tenant_id = t;
  DELETE FROM ads_autopilot_artifacts WHERE tenant_id = t;
  DELETE FROM ads_autopilot_insights WHERE tenant_id = t;
  DELETE FROM ads_autopilot_experiments WHERE tenant_id = t;
  DELETE FROM ads_autopilot_sessions WHERE tenant_id = t;
END $$;