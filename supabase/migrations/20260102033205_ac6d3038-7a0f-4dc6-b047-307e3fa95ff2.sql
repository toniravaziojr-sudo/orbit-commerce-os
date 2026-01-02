-- Add policy to allow service role to insert pages (for import functionality)
-- Service role should bypass RLS, but adding explicit policy as safety measure

CREATE POLICY "Service role can manage all pages" 
ON public.store_pages 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);