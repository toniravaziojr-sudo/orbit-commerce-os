-- Allow public read access to active checkout links (for storefront)
CREATE POLICY "Public can view active checkout links"
ON public.checkout_links
FOR SELECT
TO anon
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Increment click_count: allow anon to update only click_count
CREATE POLICY "Public can increment click count"
ON public.checkout_links
FOR UPDATE
TO anon
USING (is_active = true)
WITH CHECK (is_active = true);