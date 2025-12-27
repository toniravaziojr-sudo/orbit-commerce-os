-- Add missing INSERT policies for marketing_events_log and product_feed_status
-- (These are inserted by edge functions with service role, but adding for completeness)

-- Allow tenant owners/admins to insert marketing events (for client-side tracking)
CREATE POLICY "Tenant owners/admins can insert marketing events"
  ON public.marketing_events_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = marketing_events_log.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Allow tenant owners/admins to manage feed status
CREATE POLICY "Tenant owners/admins can insert feed status"
  ON public.product_feed_status
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = product_feed_status.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant owners/admins can update feed status"
  ON public.product_feed_status
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = product_feed_status.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );