
-- Quarentena das duas sugestões create_campaign incoerentes pendentes
-- (tenant Respeite o Homem). Não apagar — só sair da fila aprovável.

UPDATE public.ads_autopilot_actions
SET
  status = 'skipped',
  rejection_reason = 'Quality Gate v1.0.0: invalid_unknown_product_name, invalid_product_copy_mismatch, invalid_creative_product_mismatch',
  action_data = jsonb_set(
    COALESCE(action_data, '{}'::jsonb),
    '{quality_gate}',
    jsonb_build_object(
      'ok', false,
      'version', '1.0.0',
      'reason_codes', jsonb_build_array(
        'invalid_unknown_product_name',
        'invalid_product_copy_mismatch',
        'invalid_creative_product_mismatch'
      ),
      'details', jsonb_build_object('note', 'Codinome Fast Upgrade inexistente no catálogo; copy/headline divergem do produto vinculado.'),
      'blocked_at', NOW(),
      'backfill', true
    ),
    true
  )
WHERE id = '4b4ee449-5e5e-4175-8686-b987d4e8e5e5'
  AND tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status = 'pending_approval';

UPDATE public.ads_autopilot_actions
SET
  status = 'skipped',
  rejection_reason = 'Quality Gate v1.0.0: invalid_product_copy_mismatch, invalid_offer_mismatch, invalid_missing_creative, invalid_missing_destination, invalid_cold_campaign_budget_too_aggressive',
  action_data = jsonb_set(
    COALESCE(action_data, '{}'::jsonb),
    '{quality_gate}',
    jsonb_build_object(
      'ok', false,
      'version', '1.0.0',
      'reason_codes', jsonb_build_array(
        'invalid_product_copy_mismatch',
        'invalid_offer_mismatch',
        'invalid_missing_creative',
        'invalid_missing_destination',
        'invalid_cold_campaign_budget_too_aggressive'
      ),
      'details', jsonb_build_object('note', 'Produto vinculado Kit Banho; copy fala de Shampoo isolado. Sem criativo, sem destino, orçamento agressivo para TOF frio.'),
      'blocked_at', NOW(),
      'backfill', true
    ),
    true
  )
WHERE id = '922aaa82-de8f-4317-ad1a-bbc2665cdcec'
  AND tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status = 'pending_approval';
