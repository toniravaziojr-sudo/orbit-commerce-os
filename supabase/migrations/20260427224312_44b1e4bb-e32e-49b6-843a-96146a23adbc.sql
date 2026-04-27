
-- ============================================
-- ONDA 1: VISIBILIDADE DO SISTEMA
-- ============================================

-- Garantir que pg_stat_statements está habilitado (já instalado v1.11)
-- Reset para começar coleta limpa após upgrade da instância
SELECT pg_stat_statements_reset();

-- ============================================
-- TABELA: snapshots diários de saúde geral
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  
  -- Conexões
  active_connections int,
  idle_connections int,
  idle_in_transaction int,
  total_connections int,
  max_connections int,
  
  -- Cache hit ratio (>99% é saudável)
  cache_hit_ratio numeric(5,2),
  index_hit_ratio numeric(5,2),
  
  -- Tamanhos
  database_size_bytes bigint,
  largest_tables jsonb, -- top 10 tabelas por tamanho
  
  -- Filas (órfãos)
  queue_health jsonb, -- {fila_x: {pending, processing, failed, oldest_pending_age_seconds}}
  
  -- Crons
  cron_health jsonb, -- {total_jobs, failed_last_24h, slow_jobs}
  
  -- Edge functions (de logs nas últimas 24h)
  edge_health jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sps_captured_at 
  ON public.system_performance_snapshots(captured_at DESC);

ALTER TABLE public.system_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read snapshots"
  ON public.system_performance_snapshots FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Service role full access snapshots"
  ON public.system_performance_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: snapshots das queries mais pesadas
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_query_stats_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES public.system_performance_snapshots(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  
  query_hash text,
  query_sample text, -- primeiros 500 chars
  calls bigint,
  total_exec_time_ms numeric,
  mean_exec_time_ms numeric,
  max_exec_time_ms numeric,
  rows_returned bigint,
  
  rank int, -- 1-50 dentro do snapshot
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sqss_snapshot ON public.system_query_stats_snapshots(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_sqss_captured ON public.system_query_stats_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sqss_hash ON public.system_query_stats_snapshots(query_hash);

ALTER TABLE public.system_query_stats_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read query stats"
  ON public.system_query_stats_snapshots FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Service role full access query stats"
  ON public.system_query_stats_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- FUNÇÃO: captura snapshot diário
-- ============================================
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
  v_queue jsonb;
  v_cron jsonb;
BEGIN
  -- Conexões
  SELECT 
    count(*) FILTER (WHERE state = 'active'),
    count(*) FILTER (WHERE state = 'idle'),
    count(*) FILTER (WHERE state = 'idle in transaction'),
    count(*)
  INTO v_active, v_idle, v_idle_tx, v_total
  FROM pg_stat_activity
  WHERE datname = current_database();
  
  SELECT setting::int INTO v_max FROM pg_settings WHERE name = 'max_connections';
  
  -- Cache hit ratio
  SELECT 
    round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)
  INTO v_cache_ratio
  FROM pg_stat_database WHERE datname = current_database();
  
  SELECT 
    round(100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2)
  INTO v_index_ratio
  FROM pg_statio_user_indexes;
  
  -- Tamanho do banco
  v_db_size := pg_database_size(current_database());
  
  -- Top 10 tabelas
  SELECT jsonb_agg(t) INTO v_largest FROM (
    SELECT 
      schemaname || '.' || relname AS table_name,
      pg_total_relation_size(c.oid) AS total_bytes,
      pg_relation_size(c.oid) AS table_bytes,
      n_live_tup AS row_count
    FROM pg_stat_user_tables s
    JOIN pg_class c ON c.relname = s.relname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = s.schemaname)
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 10
  ) t;
  
  -- Crons (resumo)
  SELECT jsonb_build_object(
    'total_jobs', (SELECT count(*) FROM cron.job WHERE active = true),
    'failed_last_24h', (SELECT count(*) FROM cron.job_run_details WHERE start_time > now() - interval '24 hours' AND status = 'failed'),
    'success_last_24h', (SELECT count(*) FROM cron.job_run_details WHERE start_time > now() - interval '24 hours' AND status = 'succeeded')
  ) INTO v_cron;
  
  -- Inserir snapshot principal
  INSERT INTO public.system_performance_snapshots (
    active_connections, idle_connections, idle_in_transaction, total_connections, max_connections,
    cache_hit_ratio, index_hit_ratio, database_size_bytes, largest_tables, cron_health
  ) VALUES (
    v_active, v_idle, v_idle_tx, v_total, v_max,
    v_cache_ratio, v_index_ratio, v_db_size, v_largest, v_cron
  ) RETURNING id INTO v_snapshot_id;
  
  -- Top 50 queries mais lentas
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

-- ============================================
-- FUNÇÃO: overview em tempo real para o painel
-- ============================================
CREATE OR REPLACE FUNCTION public.get_system_health_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: platform admin only';
  END IF;
  
  SELECT jsonb_build_object(
    'connections', jsonb_build_object(
      'active', count(*) FILTER (WHERE state = 'active'),
      'idle', count(*) FILTER (WHERE state = 'idle'),
      'idle_in_transaction', count(*) FILTER (WHERE state = 'idle in transaction'),
      'total', count(*),
      'max', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections')
    ),
    'database_size', pg_database_size(current_database()),
    'cache_hit_ratio', (
      SELECT round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)
      FROM pg_stat_database WHERE datname = current_database()
    ),
    'captured_at', now()
  ) INTO v_result
  FROM pg_stat_activity
  WHERE datname = current_database();
  
  RETURN v_result;
END;
$$;

-- ============================================
-- FUNÇÃO: top queries lentas em tempo real
-- ============================================
CREATE OR REPLACE FUNCTION public.get_top_slow_queries(p_limit int DEFAULT 20)
RETURNS TABLE (
  query_sample text,
  calls bigint,
  total_time_ms numeric,
  mean_time_ms numeric,
  max_time_ms numeric,
  rows_returned bigint
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
  SELECT 
    left(s.query, 300)::text,
    s.calls,
    round(s.total_exec_time::numeric, 2),
    round(s.mean_exec_time::numeric, 2),
    round(s.max_exec_time::numeric, 2),
    s.rows
  FROM pg_stat_statements s
  WHERE s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%capture_system_health%'
  ORDER BY s.total_exec_time DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- FUNÇÃO: status dos crons
-- ============================================
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
  SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    last_run.start_time,
    last_run.status::text,
    EXTRACT(EPOCH FROM (last_run.end_time - last_run.start_time)) * 1000,
    (SELECT count(*) FROM cron.job_run_details WHERE jobid = j.jobid AND start_time > now() - interval '24 hours' AND status = 'failed'),
    (SELECT count(*) FROM cron.job_run_details WHERE jobid = j.jobid AND start_time > now() - interval '24 hours' AND status = 'succeeded')
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, end_time, status
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) last_run ON true
  ORDER BY j.jobid;
END;
$$;

-- ============================================
-- FUNÇÃO: saúde das filas (órfãos)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_queue_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_table record;
  v_count bigint;
  v_oldest timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied: platform admin only';
  END IF;
  
  -- Detectar todas as tabelas de fila (heurística: nome contém 'queue' ou 'inbound')
  FOR v_table IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE '%queue%' OR table_name LIKE '%inbound%')
      AND table_type = 'BASE TABLE'
  LOOP
    BEGIN
      -- Contar pendentes (heurística: status='queued' ou processed_at IS NULL)
      EXECUTE format(
        'SELECT count(*), min(created_at) FROM public.%I 
         WHERE created_at > now() - interval ''7 days''
         AND (
           (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=%L AND column_name=''status'') AND status IN (''queued'',''pending'',''processing''))
           OR (EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name=%L AND column_name=''processed_at'') AND processed_at IS NULL)
         )',
        v_table.table_name, v_table.table_name, v_table.table_name
      ) INTO v_count, v_oldest;
      
      v_result := v_result || jsonb_build_object(
        v_table.table_name,
        jsonb_build_object(
          'pending_or_orphans', COALESCE(v_count, 0),
          'oldest_pending_at', v_oldest,
          'oldest_age_seconds', CASE WHEN v_oldest IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_oldest)) ELSE NULL END
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Silenciar tabelas que não casam com a heurística
      NULL;
    END;
  END LOOP;
  
  RETURN v_result;
END;
$$;
