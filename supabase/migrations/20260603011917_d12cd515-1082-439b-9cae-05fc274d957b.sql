-- =============================================================================
-- Fase C.2 — Criar autonomy_mode em ads_autopilot_account_configs
-- =============================================================================
-- Apenas 2 modos nesta fase: 'off' (default) e 'technical_only'.
-- Nesta fase, 'technical_only' NÃO libera execução automática real.
-- =============================================================================

ALTER TABLE public.ads_autopilot_account_configs
  ADD COLUMN IF NOT EXISTS autonomy_mode text NOT NULL DEFAULT 'off';

-- Garante que registros pré-existentes ficaram em 'off' (idempotente).
UPDATE public.ads_autopilot_account_configs
   SET autonomy_mode = 'off'
 WHERE autonomy_mode IS NULL
    OR autonomy_mode NOT IN ('off', 'technical_only');

-- CHECK constraint idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ads_autopilot_account_configs_autonomy_mode_check'
  ) THEN
    ALTER TABLE public.ads_autopilot_account_configs
      ADD CONSTRAINT ads_autopilot_account_configs_autonomy_mode_check
      CHECK (autonomy_mode IN ('off', 'technical_only'));
  END IF;
END$$;

COMMENT ON COLUMN public.ads_autopilot_account_configs.autonomy_mode IS
'Fase C.2 — modo de autonomia da IA de tráfego pago. Valores: off | technical_only. Default off. `technical_only` ainda NÃO libera execução automática nesta fase — apenas declara intenção futura. `human_approval_mode` permanece legado.';

-- =============================================================================
-- Atualiza o gatilho de classificação para registrar autonomy_mode em auditoria
-- =============================================================================
-- Acrescenta blocos no policy_check_result, sem mudar comportamento prático:
--   autonomy_mode             (lido de ads_autopilot_account_configs, fallback 'off')
--   autonomy_enabled = false  (sempre nesta fase)
--   autonomy_source           ('ads_autopilot_account_configs.autonomy_mode' ou 'default_off')
--   autonomy_execution_phase  ('not_enabled_c2')
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ads_autopilot_classify_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class           text;
  v_reason          text;
  v_ad_account_id   text;
  v_autonomy_mode   text;
  v_autonomy_source text;
BEGIN
  IF NEW.action_class IS NOT NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.action_type
    WHEN 'adjust_budget','adjust_budget_up','adjust_budget_down',
         'increase_budget','decrease_budget',
         'pause_campaign','pause_adset','pause_adgroup','pause_ad',
         'reactivate_campaign','reactivate_adset','reactivate_adgroup',
         'activate_campaign','activate_adset','activate_ad',
         'schedule_action','block_action',
         'toggle_tiktok_status','update_tiktok_budget'
      THEN
        v_class  := 'automatic_candidate';
        v_reason := 'technical_action_eligible_for_future_autonomy';

    WHEN 'create_campaign','duplicate_campaign',
         'create_adset','duplicate_adset',
         'create_ad','duplicate_ad',
         'create_ad_creative','generate_creative','create_creative','edit_creative',
         'create_ad_copy','edit_ad_copy',
         'change_offer','change_promise','change_landing_page',
         'change_audience_strategy','change_optimization_goal',
         'structural_expansion_plan','create_variation',
         'create_lookalike_audience',
         'create_tiktok_campaign',
         'create_google_campaign','create_google_ad_group',
         'create_google_keyword','create_google_ad',
         'strategic_plan'
      THEN
        v_class  := 'needs_approval';
        v_reason := 'visible_or_structural_change_requires_human_approval';

    WHEN 'kill_switch_account',
         'pause_emergency_campaign','pause_emergency_adset',
         'pause_tracking_broken','pause_budget_breach','pause_broken_link'
      THEN
        v_class  := 'emergency';
        v_reason := 'emergency_risk_action';

    WHEN 'insight','report_insight','watch','recommendation','monitor','alert'
      THEN
        v_class  := 'observational';
        v_reason := 'observational_no_external_call';

    WHEN 'delete_campaign','delete_adset','delete_ad','delete_creative'
      THEN
        v_class  := 'blocked';
        v_reason := 'destructive_action_blocked';

    ELSE
      v_class  := 'needs_approval';
      v_reason := 'unknown_action_type_default_conservative';
  END CASE;

  -- Lookup do autonomy_mode (auditoria — não altera comportamento prático)
  v_ad_account_id := NULLIF(NEW.action_data->>'ad_account_id', '');
  v_autonomy_mode := NULL;

  IF v_ad_account_id IS NOT NULL THEN
    SELECT autonomy_mode
      INTO v_autonomy_mode
      FROM public.ads_autopilot_account_configs
     WHERE tenant_id     = NEW.tenant_id
       AND channel       = NEW.channel
       AND ad_account_id = v_ad_account_id
     LIMIT 1;
  END IF;

  IF v_autonomy_mode IS NULL OR v_autonomy_mode NOT IN ('off','technical_only') THEN
    v_autonomy_mode   := 'off';
    v_autonomy_source := 'default_off';
  ELSE
    v_autonomy_source := 'ads_autopilot_account_configs.autonomy_mode';
  END IF;

  NEW.action_class := v_class;
  NEW.policy_check_result := COALESCE(NEW.policy_check_result, '{}'::jsonb)
    || jsonb_build_object(
         'action_class',             v_class,
         'classification_reason',    v_reason,
         'autonomy_enabled',         false,
         'classified_by',            'ads-policy.v1',
         'autonomy_mode',            v_autonomy_mode,
         'autonomy_source',          v_autonomy_source,
         'autonomy_execution_phase', 'not_enabled_c2'
       );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ads_autopilot_classify_action() IS
'Fase C.2 — carimba action_class + autonomy_mode em auditoria. autonomy_enabled sempre false. `technical_only` NÃO libera execução automática nesta fase.';

REVOKE EXECUTE ON FUNCTION public.ads_autopilot_classify_action() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ads_autopilot_classify_action() FROM anon, authenticated;
