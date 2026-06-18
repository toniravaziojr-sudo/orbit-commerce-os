UPDATE ads_autopilot_actions
SET status = 'rejected',
    action_data = jsonb_set(
      COALESCE(action_data, '{}'::jsonb),
      '{metadata,invalidated_reason}',
      to_jsonb('Plano invalidado por inconsistência texto↔estrutura na exclusão de clientes (Onda H.6). Regenere o plano para aplicar correção.'::text)
    )
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND action_type = 'strategic_plan'
  AND status IN ('pending_approval','pendente de aprovação','pending');