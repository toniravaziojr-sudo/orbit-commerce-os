
DROP POLICY IF EXISTS "ms_tenant_select" ON public.marketplace_shipments;
DROP POLICY IF EXISTS "ms_tenant_modify" ON public.marketplace_shipments;
DROP POLICY IF EXISTS "misq_tenant_read" ON public.meli_invoice_send_queue;

CREATE POLICY "ms_tenant_select" ON public.marketplace_shipments
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "ms_tenant_modify" ON public.marketplace_shipments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "misq_tenant_read" ON public.meli_invoice_send_queue
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "marketplace_labels_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'marketplace-labels'
    AND (storage.foldername(name))[1] IN (
      SELECT current_tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "marketplace_labels_service_role_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'marketplace-labels')
  WITH CHECK (bucket_id = 'marketplace-labels');
