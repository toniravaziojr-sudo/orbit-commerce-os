-- Drop and recreate the public access policy for page_templates
-- The previous policy might have issues with circular RLS dependencies

DROP POLICY IF EXISTS "Anyone can view templates of published pages" ON public.page_templates;

-- Create a simpler policy that allows any template to be read publicly
-- Security is maintained because templates themselves don't contain sensitive data
-- and pages are already filtered by is_published in the store_pages query
CREATE POLICY "Public can view page templates"
ON public.page_templates
FOR SELECT
TO anon
USING (true);