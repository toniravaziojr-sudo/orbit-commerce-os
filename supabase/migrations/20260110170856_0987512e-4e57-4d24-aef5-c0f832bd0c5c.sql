-- Table to track all imported items for each import job
CREATE TABLE public.imported_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'product', 'category', 'customer', 'order', 'page', 'menu', 'visual'
  entity_id UUID NOT NULL,
  entity_table TEXT NOT NULL, -- 'products', 'categories', 'customers', 'orders', 'store_pages', etc.
  external_id TEXT, -- ID from source platform if available
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entity_type, entity_id)
);

-- Index for fast lookups
CREATE INDEX idx_imported_items_tenant ON public.imported_items(tenant_id);
CREATE INDEX idx_imported_items_tenant_type ON public.imported_items(tenant_id, entity_type);
CREATE INDEX idx_imported_items_entity ON public.imported_items(entity_table, entity_id);

-- Enable RLS
ALTER TABLE public.imported_items ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant members can view their imported items
CREATE POLICY "Tenant members can view imported items"
ON public.imported_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.tenant_id = imported_items.tenant_id
    AND ur.user_id = auth.uid()
  )
);

-- Policy: Tenant admins can manage imported items
CREATE POLICY "Tenant admins can manage imported items"
ON public.imported_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.tenant_id = imported_items.tenant_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Platform admins can manage all
CREATE POLICY "Platform admins can manage all imported items"
ON public.imported_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE LOWER(TRIM(pa.email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
  )
);