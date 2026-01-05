-- Drop the old recursive policy that's causing the infinite recursion
DROP POLICY IF EXISTS "Platform admins can view platform_admins" ON public.platform_admins;