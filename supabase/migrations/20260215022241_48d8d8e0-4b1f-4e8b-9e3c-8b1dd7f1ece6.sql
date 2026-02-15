
-- =============================================
-- FASE 7: TikTok Shop — Fulfillment e Logística
-- Tabela para rastrear envios/fulfillment de pedidos TikTok Shop
-- =============================================

-- Tabela de fulfillment
CREATE TABLE public.tiktok_shop_fulfillments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_order_id TEXT NOT NULL,
  tiktok_shop_order_id UUID REFERENCES public.tiktok_shop_orders(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  tracking_code TEXT,
  carrier_code TEXT,
  carrier_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tiktok_package_id TEXT,
  tiktok_fulfillment_status TEXT,
  shipping_provider_id TEXT,
  pickup_slot JSONB,
  fulfillment_data JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, tiktok_order_id, tracking_code)
);

-- Índices
CREATE INDEX idx_tiktok_shop_fulfillments_tenant ON public.tiktok_shop_fulfillments(tenant_id);
CREATE INDEX idx_tiktok_shop_fulfillments_order ON public.tiktok_shop_fulfillments(tiktok_order_id);
CREATE INDEX idx_tiktok_shop_fulfillments_status ON public.tiktok_shop_fulfillments(status);

-- RLS
ALTER TABLE public.tiktok_shop_fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view fulfillments"
  ON public.tiktok_shop_fulfillments FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert fulfillments"
  ON public.tiktok_shop_fulfillments FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update fulfillments"
  ON public.tiktok_shop_fulfillments FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_tiktok_shop_fulfillments_updated_at
  BEFORE UPDATE ON public.tiktok_shop_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
