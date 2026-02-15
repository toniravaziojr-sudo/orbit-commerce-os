
-- =============================================
-- FASE 6: TikTok Shop Orders
-- Tabela para sincronizar pedidos do TikTok Shop
-- =============================================

CREATE TABLE public.tiktok_shop_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_order_id TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tiktok_status TEXT,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  shipping_address JSONB,
  order_total_cents BIGINT DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  items JSONB DEFAULT '[]'::jsonb,
  order_data JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, tiktok_order_id)
);

-- Index
CREATE INDEX idx_tiktok_shop_orders_tenant ON public.tiktok_shop_orders(tenant_id);
CREATE INDEX idx_tiktok_shop_orders_status ON public.tiktok_shop_orders(tenant_id, status);
CREATE INDEX idx_tiktok_shop_orders_tiktok_id ON public.tiktok_shop_orders(tiktok_order_id);

-- RLS
ALTER TABLE public.tiktok_shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view TikTok Shop orders"
  ON public.tiktok_shop_orders FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert TikTok Shop orders"
  ON public.tiktok_shop_orders FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update TikTok Shop orders"
  ON public.tiktok_shop_orders FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete TikTok Shop orders"
  ON public.tiktok_shop_orders FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_tiktok_shop_orders_updated_at
  BEFORE UPDATE ON public.tiktok_shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
