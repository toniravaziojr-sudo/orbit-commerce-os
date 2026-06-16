CREATE OR REPLACE FUNCTION public.flip_campaign_proposal_lifecycle_on_creative_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action_id uuid;
  v_total int;
  v_terminal int;
  v_succeeded int;
  v_failed int;
  v_new_status text;
  v_action_data jsonb;
  v_lifecycle jsonb;
  v_current_status text;
BEGIN
  IF NEW.status NOT IN ('succeeded', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_action_id := NULLIF(NEW.settings->>'proposal_action_id', '')::uuid;
  IF v_action_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT action_data INTO v_action_data
  FROM public.ads_autopilot_actions
  WHERE id = v_action_id;

  IF v_action_data IS NULL THEN
    RETURN NEW;
  END IF;

  v_lifecycle := COALESCE(v_action_data->'lifecycle', '{}'::jsonb);
  v_current_status := v_lifecycle->>'status';

  IF v_current_status IS DISTINCT FROM 'campaign_creatives_generating' THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('succeeded', 'failed', 'cancelled')),
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status IN ('failed', 'cancelled'))
  INTO v_total, v_terminal, v_succeeded, v_failed
  FROM public.creative_jobs
  WHERE (settings->>'proposal_action_id')::uuid = v_action_id;

  IF v_terminal < v_total THEN
    RETURN NEW;
  END IF;

  IF v_succeeded > 0 THEN
    v_new_status := 'campaign_creatives_ready';
  ELSE
    v_new_status := 'campaign_creatives_failed';
  END IF;

  UPDATE public.ads_autopilot_actions
  SET action_data = jsonb_set(
    jsonb_set(
      action_data,
      '{lifecycle,status}',
      to_jsonb(v_new_status),
      true
    ),
    '{lifecycle,creatives_summary}',
    jsonb_build_object(
      'total', v_total,
      'succeeded', v_succeeded,
      'failed', v_failed,
      'finalized_at', now()
    ),
    true
  )
  WHERE id = v_action_id;

  RETURN NEW;
END;
$function$;