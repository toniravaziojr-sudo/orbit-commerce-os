CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_duration_ms numeric,
  failures_last_24h bigint,
  successes_last_24h bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: platform admin only';
  END IF;

  RETURN QUERY
  WITH jobs AS (
    SELECT
      j.jobid::bigint AS jobid,
      j.jobname::text AS jobname,
      j.schedule::text AS schedule,
      j.active
    FROM cron.job j
  ),
  recent_runs AS (
    SELECT
      d.jobid::bigint AS jobid,
      d.start_time,
      d.end_time,
      d.status::text AS status
    FROM cron.job_run_details d
    INNER JOIN jobs j ON j.jobid = d.jobid
    WHERE d.start_time > now() - interval '24 hours'
  ),
  latest_run AS (
    SELECT DISTINCT ON (r.jobid)
      r.jobid,
      r.start_time AS last_run_at,
      r.status AS last_status,
      CASE
        WHEN r.end_time IS NULL THEN NULL
        ELSE round((EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000)::numeric, 2)
      END AS last_duration_ms
    FROM recent_runs r
    ORDER BY r.jobid, r.start_time DESC
  ),
  run_counts AS (
    SELECT
      r.jobid,
      count(*) FILTER (WHERE r.status = 'failed')::bigint AS failures_last_24h,
      count(*) FILTER (WHERE r.status = 'succeeded')::bigint AS successes_last_24h
    FROM recent_runs r
    GROUP BY r.jobid
  )
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    lr.last_run_at,
    lr.last_status,
    lr.last_duration_ms,
    COALESCE(rc.failures_last_24h, 0)::bigint,
    COALESCE(rc.successes_last_24h, 0)::bigint
  FROM jobs j
  LEFT JOIN latest_run lr ON lr.jobid = j.jobid
  LEFT JOIN run_counts rc ON rc.jobid = j.jobid
  ORDER BY j.jobid;
END;
$$;