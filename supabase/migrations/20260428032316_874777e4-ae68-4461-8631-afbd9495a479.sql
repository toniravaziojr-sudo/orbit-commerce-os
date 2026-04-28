REVOKE EXECUTE ON FUNCTION public.add_credits FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_tenant_invoice FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_creative_usage FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_tenant_order_usage FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_ai_usage FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_notification_usage FROM anon, authenticated, PUBLIC;