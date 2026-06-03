CREATE OR REPLACE FUNCTION public.ads_autopilot_classify_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class text;
  v_reason text;
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

  NEW.action_class := v_class;
  NEW.policy_check_result := COALESCE(NEW.policy_check_result, '{}'::jsonb)
    || jsonb_build_object(
         'action_class',          v_class,
         'classification_reason', v_reason,
         'autonomy_enabled',      false,
         'classified_by',         'ads-policy.v1'
       );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ads_autopilot_actions_classify ON public.ads_autopilot_actions;

CREATE TRIGGER ads_autopilot_actions_classify
  BEFORE INSERT ON public.ads_autopilot_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.ads_autopilot_classify_action();

COMMENT ON FUNCTION public.ads_autopilot_classify_action() IS
'Fase C.1 — carimba action_class e metadados de classificacao no INSERT. NUNCA ativa autonomia (autonomy_enabled sempre false). Nao altera policy_engine_version.';