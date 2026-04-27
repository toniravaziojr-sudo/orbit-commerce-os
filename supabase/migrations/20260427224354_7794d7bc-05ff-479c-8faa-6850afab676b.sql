
CREATE OR REPLACE FUNCTION public.capture_system_health_snapshot()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id uuid;
  v_active int;
  v_idle int;
  v_idle_tx int;
  v_total int;
  v_max int;
  v_cache_ratio numeric;
  v_index_ratio numeric;
  v_db_size bigint;
  v_largest jsonb;
  v_cron jsonb;
BEGIN
  SELECT 
    count(*) FILTER (WHERE state = 'active'),
    count(*) FILTER (WHERE state = 'idle'),
    count(*) FILTER (WHERE state = 'idle in transaction'),
    count(*)
  INTO v_active, v_idle, v_idle_tx, v_total
  FROM pg_stat_activity
  WHERE datname = current_database();
  
  SELECT setting::int INTO v_max FROM pg_settings WHERE name = 'max_connections';
  
  SELECT round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)
  INTO v_cache_ratio
  FROM pg_stat_database WHERE datname = current_database();
  
  SELECT round(100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2)
  INTO v_index_ratio
  FROM pg_statio_user_indexes;
  
  v_db_size := pg_database_size(current_database());
  
  -- Top 10 tabelas (corrigido: usa apelido explícito)
  SELECT jsonb_agg(t) INTO v_largest FROM (
    SELECT 
      (s.schemaname || '.' || s.relname) AS table_name,
      pg_total_relation_size(format('%I.%I', s.schemaname, s.relname)::regclass) AS total_bytes,
      pg_relation_size(format('%I.%I', s.schemaname, s.relname)::regclass) AS table_bytes,
      s.n_live_tup AS row_count
    FROM pg_stat_user_tables s
    WHERE s.schemaname = 'public'
    ORDER BY pg_total_relation_size(format('%I.%I', s.schemaname, s.relname)::regclass) DESC
    LIMIT 10
  ) t;
  
  SELECT jsonb_build_object(
    'total_jobs', (SELECT count(*) FROM cron.job WHERE active = true),
    'failed_last_24h', (SELECT count(*) FROM cron.job_run_details WHERE start_time > now() - interval '24 hours' AND status = 'failed'),
    'success_last_24h', (SELECT count(*) FROM cron.job_run_details WHERE start_time > now() - interval '24 hours' AND status = 'succeeded')
  ) INTO v_cron;
  
  INSERT INTO public.system_performance_snapshots (
    active_connections, idle_connections, idle_in_transaction, total_connections, max_connections,
    cache_hit_ratio, index_hit_ratio, database_size_bytes, largest_tables, cron_health
  ) VALUES (
    v_active, v_idle, v_idle_tx, v_total, v_max,
    v_cache_ratio, v_index_ratio, v_db_size, v_largest, v_cron
  ) RETURNING id INTO v_snapshot_id;
  
  INSERT INTO public.system_query_stats_snapshots (
    snapshot_id, query_hash, query_sample, calls, total_exec_time_ms, 
    mean_exec_time_ms, max_exec_time_ms, rows_returned, rank
  )
  SELECT 
    v_snapshot_id,
    md5(query),
    left(query, 500),
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    rows,
    row_number() OVER (ORDER BY total_exec_time DESC)::int
  FROM pg_stat_statements
  WHERE query NOT ILIKE '%pg_stat_statements%'
    AND query NOT ILIKE '%capture_system_health_snapshot%'
  ORDER BY total_exec_time DESC
  LIMIT 50;
  
  RETURN v_snapshot_id;
END;
$$;
