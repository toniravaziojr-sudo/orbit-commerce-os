-- Create storage bucket for tenant files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-files', 
  'tenant-files', 
  false, 
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'text/*', 'application/json', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Create files metadata table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  is_folder BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_files_tenant_id ON public.files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_filename ON public.files(filename);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS policies for files table
CREATE POLICY "Tenant members can view files" ON public.files
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can insert files" ON public.files
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can update files" ON public.files
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can delete files" ON public.files
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- Storage policies for tenant-files bucket
CREATE POLICY "Tenant members can read their files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-files' 
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can upload files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can update their files" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can delete their files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );