
CREATE OR REPLACE FUNCTION public._bootstrap_reschedule_cron(
  p_unschedule_name text,
  p_schedule_name text,
  p_schedule text,
  p_command text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_unscheduled boolean := false;
  v_new_jobid bigint;
BEGIN
  BEGIN
    PERFORM cron.unschedule(p_unschedule_name);
    v_unscheduled := true;
  EXCEPTION WHEN OTHERS THEN
    v_unscheduled := false;
  END;

  BEGIN
    PERFORM cron.unschedule(p_schedule_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  v_new_jobid := cron.schedule(p_schedule_name, p_schedule, p_command);

  RETURN jsonb_build_object(
    'unscheduled_old', v_unscheduled,
    'new_jobid', v_new_jobid,
    'new_jobname', p_schedule_name,
    'schedule', p_schedule
  );
END;
$$;

REVOKE ALL ON FUNCTION public._bootstrap_reschedule_cron(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._bootstrap_reschedule_cron(text, text, text, text) TO service_role;
