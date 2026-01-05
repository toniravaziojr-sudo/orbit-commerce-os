-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.platform_admins;

-- Create a security definer function to get current user email safely
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Create new policy using the security definer function
CREATE POLICY "Users can check their own admin status"
  ON public.platform_admins
  FOR SELECT
  USING (email = public.get_auth_user_email());