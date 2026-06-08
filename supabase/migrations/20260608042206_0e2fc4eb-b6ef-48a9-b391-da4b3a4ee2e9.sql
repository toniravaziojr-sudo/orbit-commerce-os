
-- 1) Arquivar 5 adsets pendentes (fora do escopo da validação de campanhas)
UPDATE public.ads_autopilot_actions
SET status = 'superseded',
    rejection_reason = 'adset_suggestions_out_of_scope_for_campaign_validation',
    action_data = COALESCE(action_data, '{}'::jsonb) || jsonb_build_object(
      'audit', COALESCE(action_data->'audit', '{}'::jsonb) || jsonb_build_object(
        'superseded_at', now(),
        'superseded_reason', 'adset_suggestions_out_of_scope_for_campaign_validation',
        'superseded_by', 'manual_cleanup_quality_gate_v1_1_2'
      )
    )
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status = 'pending_approval'
  AND action_type = 'create_adset';

-- 2) Normalizar CTA das 2 campanhas SALES pendentes com CTA vazio (Shampoo + Kit 2x)
UPDATE public.ads_autopilot_actions
SET action_data = jsonb_set(
      jsonb_set(
        COALESCE(action_data, '{}'::jsonb),
        '{cta}', '"SHOP_NOW"', true
      ),
      '{preview,cta_type}', '"SHOP_NOW"', true
    ) || jsonb_build_object(
      'quality_gate', COALESCE(action_data->'quality_gate', '{}'::jsonb) || jsonb_build_object(
        'cta_normalized_by_default', true,
        'cta_default_applied', 'SHOP_NOW',
        'cta_normalized_at', now(),
        'cta_normalized_reason', 'sales_objective_requires_cta_default_safe',
        'quality_gate_version', '1.1.2'
      )
    )
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status = 'pending_approval'
  AND action_type = 'create_campaign'
  AND id IN (
    '01b29498-9157-4ad9-adb7-99beeaab7eed',
    'c68ee89c-ba8d-4a19-beb7-12af4183821a'
  )
  AND COALESCE(NULLIF(TRIM(action_data->>'cta'), ''), '') = '';
