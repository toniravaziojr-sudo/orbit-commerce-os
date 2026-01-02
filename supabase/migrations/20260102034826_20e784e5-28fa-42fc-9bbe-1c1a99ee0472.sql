-- Add policy to allow service role to manage store_page_versions (for import functionality)
CREATE POLICY "Service role can manage all page versions" 
ON public.store_page_versions 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);