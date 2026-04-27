CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
 RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean, last_run_at timestamp with time zone, last_status text, last_duration_ms numeric, failures_last_24h bigint, successes_last_24h bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: platform admin only';
  END IF;

  RETURN QUERY
  SELECT
    j.jobid::bigint AS jobid,
    j.jobname::text AS jobname,
    j.schedule::text AS schedule,
    j.active,
    last_run.start_time AS last_run_at,
    last_run.status::text AS last_status,
    (EXTRACT(EPOCH FROM (last_run.end_time - last_run.start_time)) * 1000)::numeric AS last_duration_ms,
    (SELECT count(*)::bigint FROM cron.job_run_details d2
       WHERE d2.jobid = j.jobid
         AND d2.start_time > now() - interval '24 hours'
         AND d2.status = 'failed') AS failures_last_24h,
    (SELECT count(*)::bigint FROM cron.job_run_details d3
       WHERE d3.jobid = j.jobid
         AND d3.start_time > now() - interval '24 hours'
         AND d3.status = 'succeeded') AS successes_last_24h
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time, d.end_time, d.status
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC
    LIMIT 1
  ) last_run ON true
  ORDER BY j.jobid;
END;
$function$;