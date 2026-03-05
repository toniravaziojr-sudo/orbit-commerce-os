-- Fix: RLS policy requires status='published' but edge function sets status='draft' on adjustments
-- This causes 404 on published pages after any chat adjustment
-- Solution: public view should only check is_published, not status column
DROP POLICY IF EXISTS "Public can view published landing pages" ON public.ai_landing_pages;
CREATE POLICY "Public can view published landing pages"
ON public.ai_landing_pages
FOR SELECT
TO anon, authenticated
USING (is_published = true);