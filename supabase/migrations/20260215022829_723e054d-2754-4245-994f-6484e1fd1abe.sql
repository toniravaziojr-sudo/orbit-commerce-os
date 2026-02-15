
-- =============================================
-- FASE 8: TikTok Shop — Devoluções e Pós-venda
-- Tabela: tiktok_shop_returns
-- =============================================

CREATE TABLE public.tiktok_shop_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tiktok_order_id TEXT NOT NULL,
  tiktok_return_id TEXT,
  tiktok_shop_order_id UUID REFERENCES public.tiktok_shop_orders(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  -- Return details
  return_type TEXT NOT NULL DEFAULT 'return', -- 'return', 'refund', 'replacement'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed', 'cancelled'
  tiktok_status TEXT, -- Status original da API TikTok
  reason TEXT,
  buyer_comments TEXT,
  seller_comments TEXT,
  
  -- Financial
  refund_amount_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  
  -- Shipping (devolução)
  return_tracking_code TEXT,
  return_carrier TEXT,
  return_shipping_status TEXT, -- 'awaiting_shipment', 'shipped', 'delivered'
  
  -- Items
  items JSONB DEFAULT '[]'::jsonb,
  
  -- API data
  return_data JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  requested_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint
ALTER TABLE public.tiktok_shop_returns
  ADD CONSTRAINT uq_tiktok_shop_returns_tenant_return UNIQUE (tenant_id, tiktok_return_id);

-- Index for order lookups
CREATE INDEX idx_tiktok_shop_returns_order ON public.tiktok_shop_returns(tenant_id, tiktok_order_id);

-- Updated_at trigger
CREATE TRIGGER set_tiktok_shop_returns_updated_at
  BEFORE UPDATE ON public.tiktok_shop_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tiktok_shop_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own returns"
  ON public.tiktok_shop_returns FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert own returns"
  ON public.tiktok_shop_returns FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update own returns"
  ON public.tiktok_shop_returns FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role full access to returns"
  ON public.tiktok_shop_returns FOR ALL
  USING (true)
  WITH CHECK (true);
