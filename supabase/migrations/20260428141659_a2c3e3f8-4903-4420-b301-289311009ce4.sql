-- Onda 4.3: Restrict storage.objects SELECT (LIST) on 4 public buckets
-- Public URL access continues working (public:true bypasses RLS for direct GET).
-- Only the LIST/enumeration via API is restricted by these policies.

-- 1. product-images
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
CREATE POLICY "Tenant members can list product images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- 2. published-assets
DROP POLICY IF EXISTS "Anyone can view published assets" ON storage.objects;
CREATE POLICY "Tenant members can list published assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'published-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- 3. store-assets (supports both path patterns: <tenant_id>/... and tenants/<tenant_id>/...)
DROP POLICY IF EXISTS "Anyone can view store assets" ON storage.objects;
CREATE POLICY "Tenant members can list store assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id::text = (storage.foldername(name))[1]
      )
      OR (
        (storage.foldername(name))[1] = 'tenants'
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.tenant_id::text = (storage.foldername(name))[2]
        )
      )
    )
  );

-- 4. review-media (path doesn't carry tenant_id; restrict to authenticated)
DROP POLICY IF EXISTS "Public read access for review media" ON storage.objects;
CREATE POLICY "Authenticated users can list review media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'review-media');
