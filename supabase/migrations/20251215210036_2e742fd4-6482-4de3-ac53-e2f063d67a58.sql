-- Create media_library table for storing image metadata
CREATE TABLE public.media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('desktop', 'mobile')),
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (tenant_id, file_path)
);

-- Enable RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/manage media from their tenant
CREATE POLICY "Users can view media from their tenant"
ON public.media_library
FOR SELECT
USING (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Users can insert media to their tenant"
ON public.media_library
FOR INSERT
WITH CHECK (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Users can delete media from their tenant"
ON public.media_library
FOR DELETE
USING (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- Index for faster queries
CREATE INDEX idx_media_library_tenant_variant ON public.media_library(tenant_id, variant);
CREATE INDEX idx_media_library_created_at ON public.media_library(created_at DESC);