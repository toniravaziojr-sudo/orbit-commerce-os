
CREATE OR REPLACE FUNCTION public.ads_patch_proposal_to_h22(p_action_id uuid)
RETURNS TABLE(
  action_id uuid,
  changed boolean,
  pairing_status text,
  contract_validation_status text,
  h2_missing_total int,
  h4_missing_total int,
  account_config_missing_total int
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
  v_n_adsets        int;
  v_n_planned       int;
  v_idx             int;
  v_budget_mode     text;
  v_strategy_tag    text;
  v_obj_canon       text;
  v_validation      text;
  v_pairing         text := NULL;
  v_new_planned     jsonb := '[]'::jsonb;
  v_pending         jsonb := '[]'::jsonb;
  v_step_identity   jsonb;
  v_step_campaign   jsonb;
  v_step_adset      jsonb;
  v_step_ad         jsonb;
  v_h2_total        int := 0;
  v_h4_total        int := 0;
  v_ac_total        int := 0;
  v_a_name          text;
  v_p              jsonb;
  v_target_idx     int;
  v_changed         boolean := false;
BEGIN
  SELECT * INTO v_row FROM public.ads_autopilot_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ads_autopilot_action % not found', p_action_id;
  END IF;
  IF v_row.action_type IS DISTINCT FROM 'campaign_proposal' THEN
    RAISE EXCEPTION 'action % is not a campaign_proposal', p_action_id;
  END IF;

  v_data := COALESCE(v_row.action_data, '{}'::jsonb);
  v_campaign := COALESCE(v_data->'campaign', '{}'::jsonb);
  v_adsets   := COALESCE(v_data->'adsets', '[]'::jsonb);
  v_planned  := COALESCE(v_data->'planned_creatives', '[]'::jsonb);
  v_identity := COALESCE(v_data->'identity', '{}'::jsonb);
  v_n_adsets := jsonb_array_length(v_adsets);
  v_n_planned := jsonb_array_length(v_planned);

  v_budget_mode := v_campaign->>'budget_mode';
  v_strategy_tag := v_campaign->>'internal_strategy_tag';
  v_obj_canon := v_campaign->>'objective_canonical';
  v_validation := COALESCE(v_data->>'contract_validation_status', 'ok');

  -- 1) Vínculo anúncio<->conjunto
  IF v_n_planned > 0 AND v_n_adsets > 0 THEN
    FOR v_idx IN 0..(v_n_planned - 1) LOOP
      v_p := v_planned->v_idx;
      v_target_idx := CASE
        WHEN (v_p->>'adset_index') ~ '^-?\d+$'
             AND (v_p->>'adset_index')::int BETWEEN 0 AND (v_n_adsets - 1)
          THEN (v_p->>'adset_index')::int
        ELSE LEAST(v_idx, v_n_adsets - 1)
      END;
      v_a_name := COALESCE(NULLIF((v_adsets->v_target_idx)->>'name', ''), 'Conjunto ' || (v_target_idx + 1)::text);
      v_p := v_p || jsonb_build_object(
        'index', v_idx,
        'adset_index', v_target_idx,
        'adset_key', 'adset_' || v_target_idx::text,
        'linked_adset_name', v_a_name
      );
      IF NOT (v_p ? 'creative_source') THEN
        v_p := v_p || jsonb_build_object(
          'creative_source', CASE WHEN COALESCE((v_campaign->>'requires_catalog')::boolean, false) THEN 'catalog' ELSE 'manual' END,
          'destination_type', CASE WHEN COALESCE((v_campaign->>'requires_catalog')::boolean, false) THEN 'catalog_pdp' ELSE 'website' END,
          'planned_cta', COALESCE(v_p->>'cta', v_identity->>'cta_default'),
          'utm_template', COALESCE(v_identity->'utm_base', v_data->'default_utm_params'),
          'resolution_phase', jsonb_build_object(
            'adset_link','h2_structural','format','h2_structural','cta','h2_structural',
            'destination_url','h2_structural','utm_template','h2_structural',
            'primary_text','h4_future','headline','h4_future','description','h4_future',
            'visual_prompt','h4_future','reference','h4_future','creative_final_url','h4_future',
            'creative_id','publication_final'
          )
        );
      END IF;
      v_new_planned := v_new_planned || jsonb_build_array(v_p);
    END LOOP;
    v_planned := v_new_planned;
  END IF;

  -- 2) Paridade [Teste]/ABO
  IF v_strategy_tag = 'testing' AND v_budget_mode = 'ABO' THEN
    IF v_n_planned = v_n_adsets THEN
      v_pairing := 'ok_1_to_1';
    ELSIF v_n_planned = 0 AND v_n_adsets > 0 THEN
      v_new_planned := '[]'::jsonb;
      FOR v_idx IN 0..(v_n_adsets - 1) LOOP
        v_a_name := COALESCE(NULLIF((v_adsets->v_idx)->>'name', ''), 'Conjunto ' || (v_idx + 1)::text);
        v_new_planned := v_new_planned || jsonb_build_array(jsonb_build_object(
          'index', v_idx, 'adset_index', v_idx, 'adset_key', 'adset_' || v_idx::text,
          'linked_adset_name', v_a_name,
          'generation_status', 'placeholder_pending_strategy_fill',
          'format', NULL, 'headline', NULL, 'primary_text', NULL, 'description', NULL,
          'cta', v_identity->>'cta_default', 'destination_url', NULL,
          'creative_source', CASE WHEN COALESCE((v_campaign->>'requires_catalog')::boolean, false) THEN 'catalog' ELSE 'manual' END,
          'destination_type', CASE WHEN COALESCE((v_campaign->>'requires_catalog')::boolean, false) THEN 'catalog_pdp' ELSE 'website' END,
          'planned_cta', v_identity->>'cta_default',
          'utm_template', COALESCE(v_identity->'utm_base', v_data->'default_utm_params'),
          'resolution_phase', jsonb_build_object(
            'adset_link','h2_structural','format','h2_structural','cta','h2_structural',
            'destination_url','h2_structural','utm_template','h2_structural',
            'primary_text','h4_future','headline','h4_future','description','h4_future'
          )
        ));
      END LOOP;
      v_planned := v_new_planned;
      v_pairing := 'expanded_placeholders_1_to_1';
    ELSE
      v_pairing := 'mismatch_pending_user_decision';
      IF v_validation = 'ok' THEN v_validation := 'pending_dependency'; END IF;
    END IF;
  END IF;

  -- 3) Reescreve pending_fields + checklist com FASE (apenas Sales)
  IF v_obj_canon = 'sales' AND v_validation <> 'blocked' THEN
    DECLARE
      v_id_fields    text[] := ARRAY['facebook_page_id','pixel_id','conversion_event_default'];
      v_cmp_fields   text[] := ARRAY['name','objective','buying_type','budget_type','daily_budget_cents','planned_status','attribution_window'];
      v_adset_fields text[] := ARRAY['name','audience','placements','daily_budget_cents','schedule','optimization_goal','conversion_event','audience_exclusions.customers'];
      v_ad_fields    text[] := ARRAY['creative_format','cta','destination_url','primary_text','headline'];
      v_phase        text;
      v_label        text;
      f              text;
      v_filled_id    int := 0; v_miss_id_h2  int := 0; v_miss_id_h4 int := 0; v_miss_id_ac int := 0;
      v_filled_cmp   int := 0; v_miss_cmp_h2 int := 0; v_miss_cmp_h4 int := 0; v_miss_cmp_ac int := 0;
      v_filled_ads   int := 0; v_miss_ads_h2 int := 0; v_miss_ads_h4 int := 0; v_miss_ads_ac int := 0;
      v_filled_ad    int := 0; v_miss_ad_h2  int := 0; v_miss_ad_h4 int := 0; v_miss_ad_ac int := 0;
      v_total_cmp    int;
      v_total_ads    int;
      v_total_ad     int;
      v_val          jsonb;
      v_str          text;
      v_missing      boolean;
    BEGIN
      FOREACH f IN ARRAY v_id_fields LOOP
        v_label := CASE f WHEN 'facebook_page_id' THEN 'Página do Facebook' WHEN 'pixel_id' THEN 'Pixel' WHEN 'conversion_event_default' THEN 'Evento de conversão padrão' ELSE f END;
        v_str := v_identity->>f;
        IF v_str IS NULL OR length(v_str) = 0 THEN
          v_miss_id_ac := v_miss_id_ac + 1;
          v_pending := v_pending || jsonb_build_array(jsonb_build_object('level','identity','field',f,'label_pt',v_label,'phase','account_config'));
        ELSE
          v_filled_id := v_filled_id + 1;
        END IF;
      END LOOP;

      FOREACH f IN ARRAY v_cmp_fields LOOP
        IF v_budget_mode = 'ABO' AND f = 'daily_budget_cents' THEN CONTINUE; END IF;
        v_phase := CASE f WHEN 'attribution_window' THEN 'account_config' ELSE 'h2_structural' END;
        v_label := CASE f
          WHEN 'name' THEN 'Nome' WHEN 'objective' THEN 'Objetivo' WHEN 'buying_type' THEN 'Modo de compra'
          WHEN 'budget_type' THEN 'Tipo de orçamento' WHEN 'daily_budget_cents' THEN 'Orçamento diário'
          WHEN 'planned_status' THEN 'Status inicial' WHEN 'attribution_window' THEN 'Janela de atribuição'
          ELSE f END;
        v_val := v_campaign->f;
        v_missing := (v_val IS NULL OR v_val = 'null'::jsonb OR (jsonb_typeof(v_val)='string' AND length(v_val#>>'{}') = 0));
        IF v_missing THEN
          IF v_phase='h2_structural' THEN v_miss_cmp_h2 := v_miss_cmp_h2 + 1; ELSE v_miss_cmp_ac := v_miss_cmp_ac + 1; END IF;
          v_pending := v_pending || jsonb_build_array(jsonb_build_object('level','campaign','field',f,'label_pt',v_label,'phase',v_phase));
        ELSE
          v_filled_cmp := v_filled_cmp + 1;
        END IF;
      END LOOP;

      IF v_n_adsets = 0 THEN
        v_miss_ads_h2 := 1;
        v_pending := v_pending || jsonb_build_array(jsonb_build_object('level','adset','field','adsets','label_pt','Pelo menos 1 conjunto de anúncios','phase','h2_structural'));
      ELSE
        FOR v_idx IN 0..(v_n_adsets - 1) LOOP
          FOREACH f IN ARRAY v_adset_fields LOOP
            IF v_budget_mode = 'CBO' AND f = 'daily_budget_cents' THEN CONTINUE; END IF;
            v_label := CASE f
              WHEN 'name' THEN 'Nome' WHEN 'audience' THEN 'Público' WHEN 'placements' THEN 'Posicionamentos'
              WHEN 'daily_budget_cents' THEN 'Orçamento diário' WHEN 'schedule' THEN 'Período de veiculação'
              WHEN 'optimization_goal' THEN 'Meta de otimização' WHEN 'conversion_event' THEN 'Evento de conversão'
              WHEN 'audience_exclusions.customers' THEN 'Exclusão de clientes existentes' ELSE f END;
            IF f = 'audience_exclusions.customers' THEN
              v_val := (v_adsets->v_idx->'audience_exclusions')->'customers';
            ELSE
              v_val := v_adsets->v_idx->f;
            END IF;
            v_missing := (v_val IS NULL OR v_val = 'null'::jsonb
              OR (jsonb_typeof(v_val)='array' AND jsonb_array_length(v_val)=0)
              OR (jsonb_typeof(v_val)='string' AND length(v_val#>>'{}')=0));
            IF v_missing THEN
              v_miss_ads_h2 := v_miss_ads_h2 + 1;
              v_pending := v_pending || jsonb_build_array(jsonb_build_object('level','adset','index',v_idx,'field',f,'label_pt',v_label,'phase','h2_structural'));
            ELSE
              v_filled_ads := v_filled_ads + 1;
            END IF;
          END LOOP;
        END LOOP;
      END IF;

      v_n_planned := jsonb_array_length(v_planned);
      IF v_n_planned = 0 THEN
        v_miss_ad_h2 := 1;
        v_pending := v_pending || jsonb_build_array(jsonb_build_object('level','ad','field','planned_creatives','label_pt','Pelo menos 1 anúncio planejado por conjunto','phase','h2_structural'));
      ELSE
        FOR v_idx IN 0..(v_n_planned - 1) LOOP
          FOREACH f IN ARRAY v_ad_fields LOOP
            v_phase := CASE f WHEN 'primary_text' THEN 'h4_future' WHEN 'headline' THEN 'h4_future' ELSE 'h2_structural' END;
            v_label := CASE f
              WHEN 'creative_format' THEN 'Formato do criativo' WHEN 'cta' THEN 'Botão de ação'
              WHEN 'destination_url' THEN 'Link de destino' WHEN 'primary_text' THEN 'Texto principal'
              WHEN 'headline' THEN 'Título' ELSE f END;
            IF f = 'cta' THEN
              v_val := COALESCE(v_planned->v_idx->'cta', v_planned->v_idx->'planned_cta');
            ELSIF f = 'creative_format' THEN
              v_val := COALESCE(v_planned->v_idx->'creative_format', v_planned->v_idx->'format');
            ELSE
              v_val := v_planned->v_idx->f;
            END IF;
            v_missing := (v_val IS NULL OR v_val = 'null'::jsonb
              OR (jsonb_typeof(v_val)='string' AND length(v_val#>>'{}')=0));
            IF v_missing THEN
              IF v_phase='h4_future' THEN v_miss_ad_h4 := v_miss_ad_h4 + 1; ELSE v_miss_ad_h2 := v_miss_ad_h2 + 1; END IF;
              v_pending := v_pending || jsonb_build_array(jsonb_build_object('level','ad','index',v_idx,'field',f,'label_pt',v_label,'phase',v_phase));
            ELSE
              v_filled_ad := v_filled_ad + 1;
            END IF;
          END LOOP;
        END LOOP;
      END IF;

      v_total_cmp := array_length(v_cmp_fields, 1) - CASE WHEN v_budget_mode='ABO' THEN 1 ELSE 0 END;
      v_total_ads := (array_length(v_adset_fields, 1) - CASE WHEN v_budget_mode='CBO' THEN 1 ELSE 0 END) * GREATEST(1, v_n_adsets);
      v_total_ad  := array_length(v_ad_fields, 1) * GREATEST(1, v_n_planned);

      v_step_identity := jsonb_build_object(
        'step','identity','label_pt','Identidade da conta','total', array_length(v_id_fields,1),
        'filled', v_filled_id, 'missing_count', v_miss_id_h2 + v_miss_id_h4 + v_miss_id_ac,
        'h2_missing_count', v_miss_id_h2, 'h4_missing_count', v_miss_id_h4, 'account_config_missing_count', v_miss_id_ac
      );
      v_step_campaign := jsonb_build_object(
        'step','campaign','label_pt','Campanha','total', v_total_cmp,
        'filled', v_filled_cmp, 'missing_count', v_miss_cmp_h2 + v_miss_cmp_h4 + v_miss_cmp_ac,
        'h2_missing_count', v_miss_cmp_h2, 'h4_missing_count', v_miss_cmp_h4, 'account_config_missing_count', v_miss_cmp_ac
      );
      v_step_adset := jsonb_build_object(
        'step','adset','label_pt','Conjuntos (' || v_n_adsets || ')','total', v_total_ads,
        'filled', v_filled_ads, 'missing_count', v_miss_ads_h2 + v_miss_ads_h4 + v_miss_ads_ac,
        'h2_missing_count', v_miss_ads_h2, 'h4_missing_count', v_miss_ads_h4, 'account_config_missing_count', v_miss_ads_ac
      );
      v_step_ad := jsonb_build_object(
        'step','ad','label_pt','Anúncios planejados (' || v_n_planned || ')','total', v_total_ad,
        'filled', v_filled_ad, 'missing_count', v_miss_ad_h2 + v_miss_ad_h4 + v_miss_ad_ac,
        'h2_missing_count', v_miss_ad_h2, 'h4_missing_count', v_miss_ad_h4, 'account_config_missing_count', v_miss_ad_ac
      );
      v_h2_total := v_miss_id_h2 + v_miss_cmp_h2 + v_miss_ads_h2 + v_miss_ad_h2;
      v_h4_total := v_miss_id_h4 + v_miss_cmp_h4 + v_miss_ads_h4 + v_miss_ad_h4;
      v_ac_total := v_miss_id_ac + v_miss_cmp_ac + v_miss_ads_ac + v_miss_ad_ac;
    END;
  END IF;

  v_next := v_data || jsonb_build_object(
    'planned_creatives', v_planned,
    'pending_fields', v_pending,
    'pending_fields_total', jsonb_array_length(v_pending),
    'contract_validation_status', v_validation,
    'contract_phase_version', 'h22_v1'
  );
  IF v_pairing IS NOT NULL THEN
    v_next := v_next || jsonb_build_object('testing_abo_pairing_status', v_pairing);
  END IF;
  IF v_obj_canon = 'sales' AND v_validation <> 'blocked' THEN
    v_next := v_next || jsonb_build_object(
      'meta_step_checklist', jsonb_build_array(v_step_identity, v_step_campaign, v_step_adset, v_step_ad),
      'objective_contract_label_pt', 'Vendas'
    );
  END IF;

  IF v_next IS DISTINCT FROM v_data THEN
    UPDATE public.ads_autopilot_actions SET action_data = v_next WHERE id = p_action_id;
    v_changed := true;
  END IF;

  RETURN QUERY SELECT p_action_id, v_changed, v_pairing, v_validation, v_h2_total, v_h4_total, v_ac_total;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.ads_patch_proposal_to_h22(uuid) TO service_role;

COMMENT ON FUNCTION public.ads_patch_proposal_to_h22(uuid) IS
  'Onda H.2.2 — Patch idempotente: vincula planned_creatives ao conjunto, reclassifica pending_fields/meta_step_checklist por fase (h2_structural/h4_future/account_config). Sem IA, sem Meta, sem mudança de status/aprovação.';
