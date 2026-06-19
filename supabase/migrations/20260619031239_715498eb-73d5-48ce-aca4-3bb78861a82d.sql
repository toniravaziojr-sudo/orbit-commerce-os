UPDATE ads_autopilot_actions
SET status = 'pending_approval',
    executed_at = NULL,
    approved_at = NULL,
    approved_by_user_id = NULL,
    error_message = 'Campanhas excluídas no Meta pelo usuário — retornadas para Aguardando Ação para republicação com os ajustes da Onda H.5 (UTMs, lifecycle automático, parity check).',
    action_data = action_data
      - 'execution_result'
      - 'meta_ids'
      - 'meta_parity_report'
      - 'published_at'
      - 'publication_log'
WHERE id IN (
  '1a208322-c37a-4905-8969-6570bf4d47c4',
  'ee2cf98d-de5d-4426-8845-aaad009bee27'
);