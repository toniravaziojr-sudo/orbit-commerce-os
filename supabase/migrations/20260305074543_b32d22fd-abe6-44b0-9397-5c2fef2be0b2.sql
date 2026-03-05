-- Fix system_health_checks: replace direct auth.users query with is_platform_admin()
DROP POLICY IF EXISTS "Platform admins can read all health checks" ON public.system_health_checks;
CREATE POLICY "Platform admins can read all health checks"
  ON public.system_health_checks FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

-- Fix tenant_feature_overrides: replace direct auth.users query with is_platform_admin()
DROP POLICY IF EXISTS "Platform admins can read all overrides" ON public.tenant_feature_overrides;
CREATE POLICY "Platform admins can read all overrides"
  ON public.tenant_feature_overrides FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());