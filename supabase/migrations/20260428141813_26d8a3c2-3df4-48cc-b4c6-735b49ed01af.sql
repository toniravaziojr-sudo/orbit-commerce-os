DROP POLICY IF EXISTS "Authenticated users can list review media" ON storage.objects;
CREATE POLICY "Service role can list review media"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'review-media');
