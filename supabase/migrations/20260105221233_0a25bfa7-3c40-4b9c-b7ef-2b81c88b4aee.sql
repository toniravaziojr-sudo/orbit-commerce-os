-- Drop da policy atual
DROP POLICY IF EXISTS "Platform admins can read all overrides" ON tenant_feature_overrides;

-- Recriar com normalização de email
CREATE POLICY "Platform admins can read all overrides"
ON tenant_feature_overrides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE LOWER(TRIM(pa.email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    AND pa.is_active = true
  )
);