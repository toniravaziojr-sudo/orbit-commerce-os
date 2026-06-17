
-- Limpeza de propostas e criativos do tenant Respeite o Homem para novo teste end-to-end
DO $$
DECLARE t uuid := 'd1a4d0ed-8842-495e-b741-540a9a345b25';
BEGIN
  DELETE FROM creative_jobs WHERE tenant_id = t;
  DELETE FROM ads_creative_assets WHERE tenant_id = t;
  DELETE FROM ads_autopilot_feedback WHERE tenant_id = t;
  DELETE FROM ads_autopilot_artifacts WHERE tenant_id = t;
  DELETE FROM ads_ai_warnings WHERE tenant_id = t;
  -- Filhas primeiro (parent_action_id NOT NULL), depois pais
  DELETE FROM ads_autopilot_actions WHERE tenant_id = t AND parent_action_id IS NOT NULL;
  DELETE FROM ads_autopilot_actions WHERE tenant_id = t;
  DELETE FROM ads_ai_analysis_runs WHERE tenant_id = t;
  DELETE FROM ads_autopilot_sessions WHERE tenant_id = t;
END $$;
