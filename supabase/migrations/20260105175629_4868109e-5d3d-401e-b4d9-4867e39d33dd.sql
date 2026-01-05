-- Add policy for users to check their own admin status
CREATE POLICY "Users can check their own admin status"
  ON public.platform_admins
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );