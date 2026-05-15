
-- Fix search_path na touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Revoga execução de anon nas funções da Onda A (só authenticated + service_role)
REVOKE EXECUTE ON FUNCTION public.count_active_tenants_for_module(TEXT) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_module_active(TEXT) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_skipped_cron_execution(TEXT, TEXT, TEXT) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_module_active_by_event(TEXT, UUID) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_system_resource_usage() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_module_active(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_active_tenants_for_module(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_skipped_cron_execution(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_module_active_by_event(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_system_resource_usage() TO service_role;
