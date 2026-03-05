
-- Create email-attachments storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to download attachments from their tenant
CREATE POLICY "Tenant users can download email attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.tenant_id::text FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- RLS: Allow authenticated users to upload attachments for their tenant
CREATE POLICY "Tenant users can upload email attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT ur.tenant_id::text FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- RLS: Service role can manage all (for edge functions) - already implicit with service_role
