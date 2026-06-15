
CREATE OR REPLACE FUNCTION public.ads_patch_proposal_to_v1_1(p_action_id uuid)
RETURNS TABLE(
  action_id uuid,
  changed boolean,
  budget_mode text,
  contract_validation_status text,
  unsupported_reason text,
  notes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row             public.ads_autopilot_actions%ROWTYPE;
  v_data            jsonb;
  v_next            jsonb;
  v_campaign        jsonb;
  v_adsets          jsonb;
  v_planned         jsonb;
  v_identity        jsonb;
  v_first_creative  jsonb;

  v_platform        text;
  v_objective_raw   text;
  v_obj_canon       text;
  v_plat_obj        text;
  v_ctype           text;
  v_strategy_tag    text;
  v_sales_subtype   text;

  v_campaign_cents  bigint;
  v_n_adsets        int;
  v_idx             int;
  v_has_adset_b     boolean := false;

  v_budget_mode     text;
  v_final_cmp_cents bigint;
  v_per_adset       jsonb := '{}'::jsonb;
  v_estimate        jsonb := '{}'::jsonb;

  v_requires_cat    boolean := false;
  v_product_catalog text;
  v_product_set     text;
  v_creative_source text;
  v_destination_t   text;
  v_creative_format text;
  v_destination_url text;
  v_cta_source      text;
  v_utm             jsonb;

  v_unsupported     text := NULL;
  v_validation      text := 'ok';
  v_notes           text[] := ARRAY[]::text[];
  v_changed         boolean := true;
BEGIN
  SELECT * INTO v_row FROM public.ads_autopilot_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ads_autopilot_action % not found', p_action_id;
  END IF;

  IF v_row.action_type IS DISTINCT FROM 'campaign_proposal' THEN
    RAISE EXCEPTION 'action % is not a campaign_proposal (got %)', p_action_id, v_row.action_type;
  END IF;

  v_data := COALESCE(v_row.action_data, '{}'::jsonb);
  v_campaign := COALESCE(v_data->'campaign', '{}'::jsonb);
  v_adsets   := COALESCE(v_data->'adsets', '[]'::jsonb);
  v_planned  := COALESCE(v_data->'planned_creatives', '[]'::jsonb);
  v_identity := COALESCE(v_data->'identity', '{}'::jsonb);

  v_platform := lower(COALESCE(
    NULLIF(v_data->>'platform', ''),
    NULLIF(v_campaign->>'platform', ''),
    NULLIF(v_row.channel, ''),
    'meta'
  ));

  v_objective_raw := lower(COALESCE(NULLIF(v_campaign->>'objective', ''), NULLIF(v_data->>'objective', ''), ''));
  v_obj_canon := CASE
    WHEN v_objective_raw IN ('sales','outcome_sales','purchases','conversions','vendas') THEN 'sales'
    WHEN v_objective_raw IN ('leads','outcome_leads','lead_generation') THEN 'leads'
    WHEN v_objective_raw IN ('traffic','outcome_traffic','trafego','tráfego') THEN 'traffic'
    WHEN v_objective_raw IN ('awareness','outcome_awareness','reach','brand_awareness') THEN 'awareness'
    WHEN v_objective_raw IN ('engagement','outcome_engagement') THEN 'engagement'
    WHEN v_objective_raw IN ('app_promotion','outcome_app_promotion','app') THEN 'app_promotion'
    ELSE NULL
  END;
  v_plat_obj := CASE v_obj_canon
    WHEN 'sales' THEN 'OUTCOME_SALES'
    WHEN 'leads' THEN 'OUTCOME_LEADS'
    WHEN 'traffic' THEN 'OUTCOME_TRAFFIC'
    WHEN 'awareness' THEN 'OUTCOME_AWARENESS'
    WHEN 'engagement' THEN 'OUTCOME_ENGAGEMENT'
    WHEN 'app_promotion' THEN 'OUTCOME_APP_PROMOTION'
    ELSE NULL
  END;

  IF v_platform <> 'meta' THEN
    v_unsupported := 'A plataforma "' || v_platform || '" ainda não está disponível nesta fase do Gestor de Tráfego IA. Apenas Meta Ads está habilitado.';
    v_validation := 'blocked';
  ELSIF v_obj_canon IS NULL THEN
    v_unsupported := 'Não conseguimos identificar o objetivo desta proposta. Apenas o objetivo de Vendas está disponível nesta fase.';
    v_validation := 'blocked';
  ELSIF v_obj_canon <> 'sales' THEN
    v_unsupported := 'O objetivo "' || v_obj_canon || '" ainda não está disponível nesta fase. Apenas o objetivo de Vendas está habilitado.';
    v_validation := 'blocked';
  END IF;

  v_ctype := lower(COALESCE(NULLIF(v_campaign->>'campaign_type', ''), NULLIF(v_data->>'campaign_type', ''), ''));
  v_strategy_tag := CASE
    WHEN v_ctype = '' THEN NULL
    WHEN v_ctype = 'testing' OR v_ctype LIKE '%test%' THEN 'testing'
    WHEN v_ctype = 'catalog_prospecting' THEN 'catalog_prospecting'
    WHEN v_ctype = 'catalog_retargeting' THEN 'catalog_retargeting'
    WHEN v_ctype LIKE '%retarget%' OR v_ctype LIKE '%remark%' THEN 'retargeting'
    WHEN v_ctype LIKE '%prospect%' OR v_ctype LIKE '%cold%' THEN 'prospecting'
    WHEN v_ctype LIKE '%creat%' OR v_ctype LIKE '%launch%' THEN 'creation'
    ELSE NULL
  END;

  v_sales_subtype := CASE
    WHEN v_strategy_tag IN ('catalog_prospecting','catalog_retargeting') THEN 'advantage_plus_shopping'
    WHEN lower(COALESCE(v_campaign->>'sales_subtype', v_data->>'sales_subtype', '')) = 'advantage_plus_shopping' THEN 'advantage_plus_shopping'
    ELSE 'manual_sales'
  END;

  v_campaign_cents := NULLIF(v_campaign->>'daily_budget_cents', '')::bigint;
  v_n_adsets := jsonb_array_length(v_adsets);

  IF v_n_adsets > 0 THEN
    FOR v_idx IN 0..(v_n_adsets - 1) LOOP
      DECLARE v_b bigint := NULLIF(v_adsets->v_idx->>'daily_budget_cents', '')::bigint;
      BEGIN
        IF v_b IS NOT NULL AND v_b > 0 THEN
          v_has_adset_b := true;
        END IF;
      END;
    END LOOP;
  END IF;

  IF v_strategy_tag = 'testing' THEN
    v_budget_mode := 'ABO';
    v_final_cmp_cents := NULL;
    IF v_has_adset_b THEN
      FOR v_idx IN 0..(v_n_adsets - 1) LOOP
        v_per_adset := v_per_adset || jsonb_build_object(v_idx::text,
          NULLIF(v_adsets->v_idx->>'daily_budget_cents', '')::bigint);
      END LOOP;
    ELSIF v_campaign_cents IS NOT NULL AND v_campaign_cents > 0 AND v_n_adsets > 0 THEN
      DECLARE
        v_base bigint := v_campaign_cents / v_n_adsets;
        v_rem  bigint := v_campaign_cents - (v_campaign_cents / v_n_adsets) * v_n_adsets;
      BEGIN
        FOR v_idx IN 0..(v_n_adsets - 1) LOOP
          v_per_adset := v_per_adset || jsonb_build_object(
            v_idx::text,
            v_base + CASE WHEN v_idx = v_n_adsets - 1 THEN v_rem ELSE 0 END
          );
        END LOOP;
      END;
      v_notes := array_append(v_notes, 'abo_split_from_campaign_budget');
    ELSE
      FOR v_idx IN 0..(v_n_adsets - 1) LOOP
        v_per_adset := v_per_adset || jsonb_build_object(v_idx::text, NULL);
      END LOOP;
      v_notes := array_append(v_notes, 'abo_no_budget_available');
    END IF;
  ELSE
    v_budget_mode := 'CBO';
    v_final_cmp_cents := v_campaign_cents;
    IF v_n_adsets > 0 THEN
      FOR v_idx IN 0..(v_n_adsets - 1) LOOP
        v_per_adset := v_per_adset || jsonb_build_object(v_idx::text, NULL);
        DECLARE v_b bigint := NULLIF(v_adsets->v_idx->>'daily_budget_cents', '')::bigint;
        BEGIN
          IF v_b IS NOT NULL AND v_b > 0 THEN
            v_estimate := v_estimate || jsonb_build_object(v_idx::text, v_b);
          END IF;
        END;
      END LOOP;
      IF v_estimate <> '{}'::jsonb THEN
        v_notes := array_append(v_notes, 'cbo_estimate_kept_from_legacy_adset_budgets');
      END IF;
    END IF;
  END IF;

  IF v_campaign_cents IS NOT NULL AND v_has_adset_b THEN
    v_notes := array_append(v_notes,
      CASE WHEN v_strategy_tag = 'testing' THEN 'resolved_mixed_to_abo' ELSE 'resolved_mixed_to_cbo' END);
  END IF;

  v_requires_cat := (v_sales_subtype = 'advantage_plus_shopping');
  IF v_requires_cat THEN
    v_product_catalog := NULLIF(v_campaign->>'product_catalog_id', '');
    v_product_set := NULLIF(v_campaign->>'product_set_id', '');
    IF v_product_catalog IS NULL AND v_validation = 'ok' THEN
      v_validation := 'pending_dependency';
    END IF;
  END IF;

  v_creative_source := CASE WHEN v_requires_cat THEN 'catalog' ELSE 'manual' END;
  v_destination_t   := CASE WHEN v_requires_cat THEN 'catalog_pdp' ELSE 'website' END;
  v_first_creative := CASE WHEN jsonb_array_length(v_planned) > 0 THEN v_planned->0 ELSE '{}'::jsonb END;
  v_creative_format := NULLIF(v_campaign->>'creative_format', '');
  IF v_creative_format IS NULL THEN v_creative_format := NULLIF(v_first_creative->>'format', ''); END IF;
  v_destination_url := CASE WHEN v_creative_source = 'manual' THEN COALESCE(
    NULLIF(v_first_creative->>'destination_url', ''),
    NULLIF(v_first_creative->>'final_url_with_utm', ''),
    NULLIF(v_data->>'destination_url', '')
  ) ELSE NULL END;
  v_cta_source := COALESCE(
    NULLIF(v_first_creative->>'cta', ''),
    NULLIF(v_identity->>'cta_default', ''),
    NULLIF(v_data->>'default_cta', '')
  );
  v_utm := COALESCE(v_identity->'utm_base', v_data->'utm_base', v_data->'default_utm_params');

  v_next := v_data
    || jsonb_build_object(
      'schema_version', 'campaign_proposal_v1_1',
      'contract_version', 'campaign_proposal_v1_1',
      'platform', v_platform,
      'contract_validation_status', v_validation,
      'unsupported_reason', v_unsupported
    );

  v_next := jsonb_set(v_next, '{campaign}',
    v_campaign
    || jsonb_build_object(
      'platform', v_platform,
      'platform_objective', v_plat_obj,
      'objective_canonical', v_obj_canon,
      'sales_subtype', v_sales_subtype,
      'internal_strategy_tag', v_strategy_tag,
      'budget_mode', v_budget_mode,
      'daily_budget_cents', v_final_cmp_cents,
      'requires_catalog', v_requires_cat
    )
    || CASE WHEN v_product_catalog IS NOT NULL THEN jsonb_build_object('product_catalog_id', v_product_catalog) ELSE '{}'::jsonb END
    || CASE WHEN v_product_set IS NOT NULL THEN jsonb_build_object('product_set_id', v_product_set) ELSE '{}'::jsonb END
  );

  IF v_n_adsets > 0 THEN
    DECLARE v_new_adsets jsonb := '[]'::jsonb;
    BEGIN
      FOR v_idx IN 0..(v_n_adsets - 1) LOOP
        DECLARE v_a jsonb := v_adsets->v_idx;
        BEGIN
          v_a := v_a
            || jsonb_build_object('index', v_idx, 'daily_budget_cents', v_per_adset->(v_idx::text))
            || jsonb_build_object('budget_distribution_estimate',
                CASE WHEN v_estimate ? v_idx::text THEN v_estimate->(v_idx::text) ELSE 'null'::jsonb END);
          v_new_adsets := v_new_adsets || jsonb_build_array(v_a);
        END;
      END LOOP;
      v_next := jsonb_set(v_next, '{adsets}', v_new_adsets);
    END;
  END IF;

  v_next := jsonb_set(v_next, '{contract_v1_1_meta}', jsonb_build_object(
    'creative_source', v_creative_source,
    'destination_type', v_destination_t,
    'destination_url', v_destination_url,
    'cta_source', v_cta_source,
    'creative_format', v_creative_format,
    'utm_template', v_utm,
    'notes', to_jsonb(v_notes),
    'derived_at', now()::text
  ));

  IF v_next = v_data THEN
    v_changed := false;
  ELSE
    UPDATE public.ads_autopilot_actions
       SET action_data = v_next
     WHERE id = p_action_id;
  END IF;

  RETURN QUERY SELECT
    p_action_id,
    v_changed,
    v_budget_mode,
    v_validation,
    v_unsupported,
    v_notes;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.ads_patch_proposal_to_v1_1(uuid) TO service_role;
