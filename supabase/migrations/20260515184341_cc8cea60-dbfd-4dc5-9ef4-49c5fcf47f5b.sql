-- Verifica se qualquer um dos módulos da lista está em uso
CREATE OR REPLACE FUNCTION public.is_module_active_any(p_module_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_resource_usage
    WHERE module_key = ANY(p_module_keys)
      AND status = 'active'
      AND active_tenant_count > 0
  );
$$;

-- Helper que invoca a edge function apenas se o recurso estiver em uso.
-- Caso contrário, registra a execução pulada para auditoria.
CREATE OR REPLACE FUNCTION public.cron_call_edge_if_active(
  p_module_keys text[],
  p_job_name text,
  p_function_name text,
  p_body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request_id bigint;
  v_count integer;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3NlemZqaGR2dm5jc3F5aHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcyMDksImV4cCI6MjA4MTE2MzIwOX0.xijqzFrwy221qrnnwU2PAH7Kk6Qm2AlfXhbk6uEVAVg';
BEGIN
  IF public.is_module_active_any(p_module_keys) THEN
    SELECT net.http_post(
      url := 'https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/' || p_function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := p_body
    ) INTO v_request_id;
    RETURN v_request_id;
  ELSE
    SELECT COALESCE(SUM(active_tenant_count), 0)::int INTO v_count
    FROM public.system_resource_usage
    WHERE module_key = ANY(p_module_keys);

    INSERT INTO public.system_resource_skip_log(module_key, cron_job_name, reason, active_tenant_count)
    VALUES (p_module_keys[1], p_job_name, 'no_active_tenants', v_count);
    RETURN NULL;
  END IF;
END;
$$;