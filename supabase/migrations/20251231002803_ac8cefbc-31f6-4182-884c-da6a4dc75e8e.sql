-- Add RLS policy for public read access to page_templates
-- This allows anonymous users to read templates that are associated with published pages

CREATE POLICY "Anyone can view templates of published pages"
ON public.page_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM store_pages sp
    WHERE sp.template_id = page_templates.id
    AND sp.is_published = true
  )
);