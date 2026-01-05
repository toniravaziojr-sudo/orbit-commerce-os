-- Add RLS policies for platform admins on health check tables

-- Policy for system_health_check_targets - platform admins can read all
CREATE POLICY "Platform admins can read all health targets"
ON system_health_check_targets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE LOWER(TRIM(pa.email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    AND pa.is_active = true
  )
);

-- Policy for system_health_check_targets - platform admins can manage all
CREATE POLICY "Platform admins can manage all health targets"
ON system_health_check_targets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE LOWER(TRIM(pa.email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    AND pa.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE LOWER(TRIM(pa.email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    AND pa.is_active = true
  )
);

-- Policy for system_health_checks - platform admins can read all
CREATE POLICY "Platform admins can read all health checks"
ON system_health_checks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE LOWER(TRIM(pa.email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    AND pa.is_active = true
  )
);