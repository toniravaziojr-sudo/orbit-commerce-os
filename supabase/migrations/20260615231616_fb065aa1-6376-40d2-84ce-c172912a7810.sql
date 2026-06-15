
DO $$
DECLARE
  r RECORD;
  new_data jsonb;
  pc jsonb;
  new_pc jsonb;
  pending jsonb;
  new_pending jsonb;
  step jsonb;
  new_checklist jsonb;
  is_testing boolean;
  requires_catalog boolean;
  obj text;
  platform text;
  removed_count int;
BEGIN
  FOR r IN
    SELECT id, action_data
    FROM public.ads_autopilot_actions
    WHERE action_type = 'campaign_proposal'
      AND status = 'pending_approval'
  LOOP
    new_data := r.action_data;
    platform := lower(coalesce(new_data->'campaign'->>'platform', 'meta'));
    obj := lower(coalesce(new_data->'campaign'->>'objective_canonical', ''));
    is_testing := lower(coalesce(new_data->'campaign'->>'internal_strategy_tag', '')) = 'testing';
    requires_catalog := coalesce((new_data->'campaign'->>'requires_catalog')::boolean, false);

    IF platform <> 'meta' OR obj <> 'sales' OR is_testing OR requires_catalog THEN
      CONTINUE;
    END IF;

    new_pc := '[]'::jsonb;
    removed_count := 0;
    FOR pc IN SELECT * FROM jsonb_array_elements(coalesce(new_data->'planned_creatives','[]'::jsonb))
    LOOP
      IF coalesce(pc->>'format', '') = '' THEN
        pc := pc || jsonb_build_object(
          'format', 'single_image',
          'creative_format', 'single_image',
          'format_label', 'Imagem única',
          'format_source', 'meta_sales_manual_contract_default',
          'format_source_label_pt', 'Padrão do contrato Meta Vendas',
          'format_resolution_phase', 'h2_structural',
          'format_missing_reason', null
        );
        IF pc ? 'resolution_phase' THEN
          pc := jsonb_set(pc, '{resolution_phase,format}', '"h2_structural"'::jsonb, true);
        END IF;
        removed_count := removed_count + 1;
      ELSE
        IF coalesce(pc->>'creative_format', '') = '' THEN
          pc := pc || jsonb_build_object('creative_format', pc->>'format');
        END IF;
      END IF;
      new_pc := new_pc || jsonb_build_array(pc);
    END LOOP;
    new_data := jsonb_set(new_data, '{planned_creatives}', new_pc);

    IF removed_count = 0 THEN
      CONTINUE;
    END IF;

    new_pending := '[]'::jsonb;
    FOR pending IN SELECT * FROM jsonb_array_elements(coalesce(new_data->'pending_fields','[]'::jsonb))
    LOOP
      IF pending->>'level' = 'ad' AND pending->>'field' = 'creative_format' THEN
        CONTINUE;
      END IF;
      new_pending := new_pending || jsonb_build_array(pending);
    END LOOP;
    new_data := jsonb_set(new_data, '{pending_fields}', new_pending);
    new_data := jsonb_set(new_data, '{pending_fields_total}', to_jsonb(jsonb_array_length(new_pending)));

    new_checklist := '[]'::jsonb;
    FOR step IN SELECT * FROM jsonb_array_elements(coalesce(new_data->'meta_step_checklist','[]'::jsonb))
    LOOP
      IF step->>'step' = 'ad' THEN
        step := jsonb_set(step, '{filled}', to_jsonb(coalesce((step->>'filled')::int, 0) + removed_count));
        step := jsonb_set(step, '{missing_count}', to_jsonb(greatest(0, coalesce((step->>'missing_count')::int, 0) - removed_count)));
        step := jsonb_set(step, '{h2_missing_count}', to_jsonb(greatest(0, coalesce((step->>'h2_missing_count')::int, 0) - removed_count)));
      END IF;
      new_checklist := new_checklist || jsonb_build_array(step);
    END LOOP;
    new_data := jsonb_set(new_data, '{meta_step_checklist}', new_checklist);

    UPDATE public.ads_autopilot_actions
    SET action_data = new_data
    WHERE id = r.id;
  END LOOP;
END $$;
