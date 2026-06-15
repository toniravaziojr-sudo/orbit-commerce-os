
CREATE OR REPLACE FUNCTION public.ads_patch_proposal_to_h24(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action      public.ads_autopilot_actions;
  v_data        jsonb;
  v_tenant      uuid;
  v_domain      text;
  v_product_name text;
  v_slug        text;
  v_creatives   jsonb;
  v_new_creatives jsonb := '[]'::jsonb;
  v_creative    jsonb;
  v_existing_url text;
  v_url         text;
  v_source      text;
  v_reason      text;
  v_filled_added int := 0;
  v_pending     jsonb;
  v_new_pending jsonb := '[]'::jsonb;
  v_p           jsonb;
  v_checklist   jsonb;
  v_new_checklist jsonb := '[]'::jsonb;
  v_step        jsonb;
BEGIN
  SELECT * INTO v_action
  FROM public.ads_autopilot_actions
  WHERE id = p_id AND action_type = 'campaign_proposal';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_tenant := v_action.tenant_id;
  v_data   := v_action.action_data;
  v_product_name := NULLIF(trim(v_data->'raw_planned_action'->>'product_name'), '');

  SELECT domain INTO v_domain
  FROM public.tenant_domains
  WHERE tenant_id = v_tenant
    AND is_primary = true
    AND status = 'verified'
    AND ssl_status = 'active'
  LIMIT 1;

  IF v_product_name IS NOT NULL THEN
    SELECT slug INTO v_slug
    FROM public.products
    WHERE tenant_id = v_tenant
      AND deleted_at IS NULL
      AND status = 'active'
      AND lower(name) = lower(v_product_name)
    ORDER BY length(slug) ASC
    LIMIT 1;
  END IF;

  v_creatives := COALESCE(v_data->'planned_creatives', '[]'::jsonb);

  FOR v_creative IN SELECT jsonb_array_elements(v_creatives) LOOP
    v_existing_url := NULLIF(v_creative->>'destination_url', '');

    IF v_existing_url IS NOT NULL AND v_existing_url LIKE 'https://%'
       AND v_existing_url NOT ILIKE '%localhost%'
       AND v_existing_url NOT ILIKE '%lovable.app%'
       AND v_existing_url NOT ILIKE '%/admin%'
       AND v_existing_url NOT ILIKE '%/preview%'
    THEN
      v_new_creatives := v_new_creatives || jsonb_build_array(v_creative);
      CONTINUE;
    END IF;

    IF v_slug IS NOT NULL AND v_domain IS NOT NULL THEN
      v_url    := 'https://' || v_domain || '/produto/' || v_slug;
      v_source := 'domain_derived';
      v_reason := NULL;
      v_filled_added := v_filled_added + 1;
    ELSIF v_slug IS NOT NULL AND v_domain IS NULL THEN
      v_url := NULL; v_source := NULL; v_reason := 'store_public_domain_not_verified';
    ELSIF v_product_name IS NOT NULL THEN
      v_url := NULL; v_source := NULL; v_reason := 'product_offer_url_missing';
    ELSE
      v_url := NULL; v_source := NULL; v_reason := 'no_product_or_offer_linked';
    END IF;

    v_creative := v_creative
      || jsonb_build_object(
        'destination_url', to_jsonb(v_url),
        'destination_source', to_jsonb(v_source),
        'destination_pending_reason', to_jsonb(v_reason)
      );
    v_new_creatives := v_new_creatives || jsonb_build_array(v_creative);
  END LOOP;

  v_data := v_data || jsonb_build_object('planned_creatives', v_new_creatives);

  IF v_filled_added > 0 THEN
    v_pending := COALESCE(v_data->'pending_fields', '[]'::jsonb);
    FOR v_p IN SELECT jsonb_array_elements(v_pending) LOOP
      IF (v_p->>'level' = 'ad' AND v_p->>'field' = 'destination_url') THEN
        CONTINUE;
      END IF;
      v_new_pending := v_new_pending || jsonb_build_array(v_p);
    END LOOP;

    v_checklist := COALESCE(v_data->'meta_step_checklist', '[]'::jsonb);
    FOR v_step IN SELECT jsonb_array_elements(v_checklist) LOOP
      IF v_step->>'step' = 'ad' THEN
        v_step := jsonb_set(v_step, '{filled}',
          to_jsonb(COALESCE((v_step->>'filled')::int, 0) + v_filled_added));
        v_step := jsonb_set(v_step, '{missing_count}',
          to_jsonb(GREATEST(0, COALESCE((v_step->>'missing_count')::int, 0) - v_filled_added)));
        v_step := jsonb_set(v_step, '{h2_missing_count}',
          to_jsonb(GREATEST(0, COALESCE((v_step->>'h2_missing_count')::int, 0) - v_filled_added)));
      END IF;
      v_new_checklist := v_new_checklist || jsonb_build_array(v_step);
    END LOOP;

    v_data := v_data
      || jsonb_build_object(
        'pending_fields', v_new_pending,
        'pending_fields_total', jsonb_array_length(v_new_pending),
        'meta_step_checklist', v_new_checklist
      );
  END IF;

  UPDATE public.ads_autopilot_actions
  SET action_data = v_data
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', v_tenant,
    'domain_verified', v_domain,
    'product_name', v_product_name,
    'product_slug', v_slug,
    'creatives_filled', v_filled_added
  );
END
$$;

REVOKE ALL ON FUNCTION public.ads_patch_proposal_to_h24(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ads_patch_proposal_to_h24(uuid) TO service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.ads_autopilot_actions
    WHERE action_type = 'campaign_proposal'
      AND status = 'pending_approval'
  LOOP
    PERFORM public.ads_patch_proposal_to_h24(r.id);
  END LOOP;
END
$$;
