
-- Fase 5: Tabela para sincronização de catálogo TikTok Shop
CREATE TABLE public.tiktok_shop_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tiktok_product_id TEXT,
  tiktok_sku_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sync_action TEXT NOT NULL DEFAULT 'create',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  tiktok_status TEXT,
  tiktok_category_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id)
);

-- Índices
CREATE INDEX idx_tiktok_shop_products_tenant ON public.tiktok_shop_products(tenant_id);
CREATE INDEX idx_tiktok_shop_products_status ON public.tiktok_shop_products(tenant_id, status);
CREATE INDEX idx_tiktok_shop_products_tiktok_id ON public.tiktok_shop_products(tiktok_product_id) WHERE tiktok_product_id IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER update_tiktok_shop_products_updated_at
  BEFORE UPDATE ON public.tiktok_shop_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tiktok_shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view tiktok shop products"
  ON public.tiktok_shop_products FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert tiktok shop products"
  ON public.tiktok_shop_products FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update tiktok shop products"
  ON public.tiktok_shop_products FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete tiktok shop products"
  ON public.tiktok_shop_products FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));
