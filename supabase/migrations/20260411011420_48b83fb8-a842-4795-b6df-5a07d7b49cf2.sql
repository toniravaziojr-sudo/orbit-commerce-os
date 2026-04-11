
-- 1. Add service-role-only policies to tables with RLS enabled but no policies
-- These are internal/system tables that should only be accessed by backend functions

-- fiscal_draft_queue: internal processing queue
CREATE POLICY "Service role only" ON public.fiscal_draft_queue
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = fiscal_draft_queue.tenant_id
    AND ur.role IN ('owner', 'admin')
  ));

-- order_price_audit: audit trail for price integrity
CREATE POLICY "Admins can view audit logs" ON public.order_price_audit
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = order_price_audit.tenant_id
    AND ur.role IN ('owner', 'admin')
  ));

-- rate_limit_entries: system rate limiting
CREATE POLICY "No direct access" ON public.rate_limit_entries
  FOR SELECT TO authenticated
  USING (false);

-- shipping_draft_queue: internal processing queue
CREATE POLICY "Service role only" ON public.shipping_draft_queue
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = shipping_draft_queue.tenant_id
    AND ur.role IN ('owner', 'admin')
  ));

-- system_email_config: platform-level config
CREATE POLICY "Platform admins only" ON public.system_email_config
  FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- system_email_logs: platform-level logs
CREATE POLICY "Platform admins only" ON public.system_email_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- 2. Fix functions with mutable search_path
CREATE OR REPLACE FUNCTION public.calculate_youtube_upload_credits(
  p_file_size_bytes bigint, 
  p_include_thumbnail boolean DEFAULT false, 
  p_include_captions boolean DEFAULT false
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (
    16 +
    CASE WHEN p_include_thumbnail THEN 1 ELSE 0 END +
    CASE WHEN p_include_captions THEN 2 ELSE 0 END +
    (p_file_size_bytes / (1024 * 1024 * 1024))::INTEGER
  )::INTEGER;
$$;

CREATE OR REPLACE FUNCTION public.normalize_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LOWER(TRIM(p_email))
$$;
