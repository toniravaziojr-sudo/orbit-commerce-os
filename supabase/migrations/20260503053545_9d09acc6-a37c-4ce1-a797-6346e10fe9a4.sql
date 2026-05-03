-- Religa Turn Orchestrator para Respeite o Homem
UPDATE ai_support_config
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{turn_orchestrator_enabled}',
  'true'::jsonb,
  true
),
updated_at = now()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';