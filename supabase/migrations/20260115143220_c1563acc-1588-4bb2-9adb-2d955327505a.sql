-- Add public read policy for published template content
-- This allows the public storefront to fetch published templates without authentication

CREATE POLICY "Public can read published templates"
ON public.storefront_template_sets
FOR SELECT
USING (
  is_published = true AND published_content IS NOT NULL
);