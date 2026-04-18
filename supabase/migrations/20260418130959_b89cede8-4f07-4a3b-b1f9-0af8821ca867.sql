-- Tabela de log de saúde do cache de pré-renderização
CREATE TABLE IF NOT EXISTS public.storefront_cache_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid,
  total_pages integer NOT NULL DEFAULT 0,
  active_pages integer NOT NULL DEFAULT 0,
  stale_pages integer NOT NULL DEFAULT 0,
  pending_pages integer NOT NULL DEFAULT 0,
  stale_pct numeric(5,2) NOT NULL DEFAULT 0,
  triggered_reprerender boolean NOT NULL DEFAULT false,
  reprerender_status text,
  notes text
);

ALTER TABLE public.storefront_cache_health_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access cache health log" ON public.storefront_cache_health_log;
CREATE POLICY "Service role full access cache health log"
  ON public.storefront_cache_health_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins can read cache health log" ON public.storefront_cache_health_log;
CREATE POLICY "Platform admins can read cache health log"
  ON public.storefront_cache_health_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_cache_health_checked_at ON public.storefront_cache_health_log(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_health_tenant ON public.storefront_cache_health_log(tenant_id, checked_at DESC);

-- Função de checagem de saúde do cache
CREATE OR REPLACE FUNCTION public.check_prerender_cache_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record record;
  v_supabase_url text := 'https://ojssezfjhdvvncsqyhyq.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3NlemZqaGR2dm5jc3F5aHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcyMDksImV4cCI6MjA4MTE2MzIwOX0.xijqzFrwy221qrnnwU2PAH7Kk6Qm2AlfXhbk6uEVAVg';
  v_threshold numeric := 20.0;
  v_total integer := 0;
  v_triggered integer := 0;
BEGIN
  FOR v_record IN
    SELECT
      tenant_id,
      COUNT(*) AS total_pages,
      COUNT(*) FILTER (WHERE status = 'active') AS active_pages,
      COUNT(*) FILTER (WHERE status = 'stale') AS stale_pages,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_pages,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'stale')::numeric / GREATEST(COUNT(*), 1), 2) AS stale_pct
    FROM public.storefront_prerendered_pages
    GROUP BY tenant_id
  LOOP
    v_total := v_total + 1;

    IF v_record.stale_pct > v_threshold THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/storefront-prerender',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', v_anon_key
          ),
          body := jsonb_build_object(
            'tenant_id', v_record.tenant_id,
            'trigger_type', 'manual'
          )
        );
        v_triggered := v_triggered + 1;

        INSERT INTO public.storefront_cache_health_log
          (tenant_id, total_pages, active_pages, stale_pages, pending_pages, stale_pct, triggered_reprerender, reprerender_status, notes)
        VALUES
          (v_record.tenant_id, v_record.total_pages, v_record.active_pages, v_record.stale_pages, v_record.pending_pages, v_record.stale_pct, true, 'requested', 'Auto-triggered: stale > 20%');
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.storefront_cache_health_log
          (tenant_id, total_pages, active_pages, stale_pages, pending_pages, stale_pct, triggered_reprerender, reprerender_status, notes)
        VALUES
          (v_record.tenant_id, v_record.total_pages, v_record.active_pages, v_record.stale_pages, v_record.pending_pages, v_record.stale_pct, false, 'error', SQLERRM);
      END;
    ELSE
      INSERT INTO public.storefront_cache_health_log
        (tenant_id, total_pages, active_pages, stale_pages, pending_pages, stale_pct, triggered_reprerender, notes)
      VALUES
        (v_record.tenant_id, v_record.total_pages, v_record.active_pages, v_record.stale_pages, v_record.pending_pages, v_record.stale_pct, false, 'Healthy');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tenants_checked', v_total,
    'reprerender_triggered', v_triggered,
    'threshold_pct', v_threshold,
    'checked_at', now()
  );
END;
$$;