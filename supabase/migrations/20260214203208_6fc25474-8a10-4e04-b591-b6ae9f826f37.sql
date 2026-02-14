
-- Meta Catalog Items: tracks product sync status with Meta Commerce catalog
CREATE TABLE public.meta_catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  catalog_id TEXT NOT NULL,
  meta_product_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id, catalog_id)
);

-- Index for lookups
CREATE INDEX idx_meta_catalog_items_tenant ON public.meta_catalog_items(tenant_id);
CREATE INDEX idx_meta_catalog_items_product ON public.meta_catalog_items(product_id);
CREATE INDEX idx_meta_catalog_items_status ON public.meta_catalog_items(tenant_id, status);

-- RLS
ALTER TABLE public.meta_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view catalog items"
ON public.meta_catalog_items FOR SELECT
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert catalog items"
ON public.meta_catalog_items FOR INSERT
WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update catalog items"
ON public.meta_catalog_items FOR UPDATE
USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete catalog items"
ON public.meta_catalog_items FOR DELETE
USING (public.user_has_tenant_access(tenant_id));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access on meta_catalog_items"
ON public.meta_catalog_items FOR ALL
USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_meta_catalog_items_updated_at
BEFORE UPDATE ON public.meta_catalog_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
