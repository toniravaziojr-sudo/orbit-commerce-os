CREATE OR REPLACE FUNCTION public.ads_patch_proposal_to_h23(p_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_campaign jsonb;
  v_strategy_tag text;
  v_objective text;
  v_is_testing boolean;
  v_default_cta text;
  v_planned jsonb;
  v_creative jsonb;
  v_new_creatives jsonb := '[]'::jsonb;
  v_pending jsonb;
  v_new_pending jsonb := '[]'::jsonb;
  v_p jsonb;
  v_checklist jsonb;
  v_new_checklist jsonb := '[]'::jsonb;
  v_step jsonb;
  v_changes int := 0;
BEGIN
  SELECT action_data INTO v_data
  FROM ads_autopilot_actions
  WHERE id = p_action_id AND action_type = 'campaign_proposal';

  IF v_data IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_campaign := COALESCE(v_data->'campaign', '{}'::jsonb);
  v_strategy_tag := lower(COALESCE(v_campaign->>'internal_strategy_tag', ''));
  v_objective := lower(COALESCE(v_campaign->>'objective_canonical', v_campaign->>'objective', ''));
  v_is_testing := v_strategy_tag = 'testing';
  v_default_cta := CASE
    WHEN v_objective IN ('sales','outcome_sales','purchases','conversions','vendas') THEN 'SHOP_NOW'
    WHEN v_objective IN ('leads','outcome_leads') THEN 'SIGN_UP'
    WHEN v_objective IN ('traffic','outcome_traffic') THEN 'LEARN_MORE'
    ELSE NULL
  END;

  v_planned := COALESCE(v_data->'planned_creatives', '[]'::jsonb);
  FOR v_creative IN SELECT * FROM jsonb_array_elements(v_planned) LOOP
    DECLARE
      v_c jsonb := v_creative;
      v_phase jsonb := COALESCE(v_c->'resolution_phase', '{}'::jsonb);
      v_has_cta boolean := (v_c->>'cta') IS NOT NULL AND length(trim(v_c->>'cta')) > 0;
      v_has_dest boolean := (v_c->>'destination_url') IS NOT NULL AND length(trim(v_c->>'destination_url')) > 0;
    BEGIN
      IF v_is_testing THEN
        v_c := jsonb_set(v_c, '{format}', 'null'::jsonb, true);
        v_phase := jsonb_set(v_phase, '{format}', '"h4_future"'::jsonb, true);
      ELSE
        v_phase := jsonb_set(v_phase, '{format}', '"h2_structural"'::jsonb, true);
      END IF;

      IF NOT v_has_cta AND v_default_cta IS NOT NULL THEN
        v_c := jsonb_set(v_c, '{cta}', to_jsonb(v_default_cta), true);
        v_c := jsonb_set(v_c, '{planned_cta}', to_jsonb(v_default_cta), true);
        v_c := jsonb_set(v_c, '{cta_source}', '"objective_default"'::jsonb, true);
      ELSIF v_has_cta AND (v_c->>'cta_source') IS NULL THEN
        v_c := jsonb_set(v_c, '{cta_source}', '"ad_override"'::jsonb, true);
      END IF;

      IF v_has_dest THEN
        IF (v_c->>'destination_source') IS NULL THEN
          v_c := jsonb_set(v_c, '{destination_source}', '"ad_override"'::jsonb, true);
        END IF;
        v_c := jsonb_set(v_c, '{destination_pending_reason}', 'null'::jsonb, true);
      ELSE
        v_c := jsonb_set(v_c, '{destination_pending_reason}', '"product_offer_url_missing"'::jsonb, true);
      END IF;

      v_c := jsonb_set(v_c, '{resolution_phase}', v_phase, true);
      v_new_creatives := v_new_creatives || jsonb_build_array(v_c);
      v_changes := v_changes + 1;
    END;
  END LOOP;

  v_pending := COALESCE(v_data->'pending_fields', '[]'::jsonb);
  FOR v_p IN SELECT * FROM jsonb_array_elements(v_pending) LOOP
    DECLARE
      v_level text := v_p->>'level';
      v_field text := v_p->>'field';
      v_keep boolean := true;
      v_pp jsonb := v_p;
    BEGIN
      IF v_level = 'ad' AND v_field = 'cta' AND v_default_cta IS NOT NULL THEN
        v_keep := false;
      ELSIF v_level = 'ad' AND v_field = 'creative_format' AND v_is_testing THEN
        v_pp := jsonb_set(v_pp, '{phase}', '"h4_future"'::jsonb, true);
      END IF;
      IF v_keep THEN
        v_new_pending := v_new_pending || jsonb_build_array(v_pp);
      END IF;
    END;
  END LOOP;

  v_checklist := COALESCE(v_data->'meta_step_checklist', '[]'::jsonb);
  FOR v_step IN SELECT * FROM jsonb_array_elements(v_checklist) LOOP
    DECLARE
      v_s jsonb := v_step;
      v_st text := v_s->>'step';
      v_total int := COALESCE((v_s->>'total')::int, 0);
      v_h2 int := 0; v_h4 int := 0; v_ac int := 0; v_miss int := 0;
      v_q jsonb;
    BEGIN
      FOR v_q IN SELECT * FROM jsonb_array_elements(v_new_pending) LOOP
        IF v_q->>'level' = v_st THEN
          v_miss := v_miss + 1;
          CASE v_q->>'phase'
            WHEN 'h2_structural' THEN v_h2 := v_h2 + 1;
            WHEN 'h4_future' THEN v_h4 := v_h4 + 1;
            WHEN 'account_config' THEN v_ac := v_ac + 1;
            ELSE NULL;
          END CASE;
        END IF;
      END LOOP;
      v_s := jsonb_set(v_s, '{missing_count}', to_jsonb(v_miss), true);
      v_s := jsonb_set(v_s, '{h2_missing_count}', to_jsonb(v_h2), true);
      v_s := jsonb_set(v_s, '{h4_missing_count}', to_jsonb(v_h4), true);
      v_s := jsonb_set(v_s, '{account_config_missing_count}', to_jsonb(v_ac), true);
      v_s := jsonb_set(v_s, '{filled}', to_jsonb(GREATEST(0, v_total - v_miss)), true);
      v_new_checklist := v_new_checklist || jsonb_build_array(v_s);
    END;
  END LOOP;

  v_data := jsonb_set(v_data, '{planned_creatives}', v_new_creatives, true);
  v_data := jsonb_set(v_data, '{pending_fields}', v_new_pending, true);
  v_data := jsonb_set(v_data, '{pending_fields_total}', to_jsonb(jsonb_array_length(v_new_pending)), true);
  v_data := jsonb_set(v_data, '{meta_step_checklist}', v_new_checklist, true);
  v_data := jsonb_set(v_data, '{contract_phase_version}', '"h23_v1"'::jsonb, true);

  UPDATE ads_autopilot_actions
  SET action_data = v_data
  WHERE id = p_action_id;

  RETURN jsonb_build_object(
    'ok', true,
    'creatives_patched', v_changes,
    'pending_total', jsonb_array_length(v_new_pending),
    'is_testing', v_is_testing,
    'default_cta', v_default_cta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ads_patch_proposal_to_h23(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ads_patch_proposal_to_h23(uuid) TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM ads_autopilot_actions
    WHERE action_type = 'campaign_proposal'
      AND status = 'pending_approval'
      AND action_data->>'schema_version' = 'campaign_proposal_v1_1'
  LOOP
    PERFORM public.ads_patch_proposal_to_h23(r.id);
  END LOOP;
END $$;