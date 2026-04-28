-- Onda 4.2 - Migration 1: Close privilege escalation on user_roles
-- Drops the insecure "System can insert roles" policy that allowed ANY authenticated
-- user to insert ANY role for ANY tenant. Legitimate inserts are covered by:
--   1. "Owner can manage tenant user_roles" (ALL with is_tenant_owner check)
--   2. service_role from Edge Functions (bypasses RLS)

DROP POLICY IF EXISTS "System can insert roles" ON public.user_roles;

-- Add explicit comment to document the security model
COMMENT ON TABLE public.user_roles IS 
  'Tenant-scoped role assignments. INSERT/UPDATE/DELETE restricted to tenant owners (via Owner can manage tenant user_roles policy) or service_role (Edge Functions). Self-assignment is forbidden to prevent privilege escalation.';
