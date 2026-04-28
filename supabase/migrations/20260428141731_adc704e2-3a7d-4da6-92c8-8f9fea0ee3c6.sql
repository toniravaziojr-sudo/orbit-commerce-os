DROP POLICY IF EXISTS "Tenant users can view own media assets" ON storage.objects;
CREATE POLICY "Tenant members can list media assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id::text = (storage.foldername(objects.name))[1]
    )
  );
