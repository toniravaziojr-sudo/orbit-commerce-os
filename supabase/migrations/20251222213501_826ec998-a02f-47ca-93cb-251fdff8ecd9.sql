-- =============================================
-- SHIPMENTS TABLE - Remessas/Entregas
-- Suporta 1 pedido → N remessas
-- =============================================

-- Create delivery status enum (padronizado)
CREATE TYPE public.delivery_status AS ENUM (
  'label_created',
  'posted',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'canceled',
  'unknown'
);

-- Create shipments table
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier TEXT NOT NULL,
  tracking_code TEXT NOT NULL,
  delivery_status public.delivery_status NOT NULL DEFAULT 'label_created',
  last_status_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  estimated_delivery_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'manual', -- 'manual', 'bling', 'melhor_envio', etc.
  source_id TEXT, -- ID original no sistema de origem
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipment events table (histórico de rastreio)
CREATE TABLE public.shipment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  description TEXT,
  location TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX idx_shipments_tenant_id ON public.shipments(tenant_id);
CREATE INDEX idx_shipments_tracking_code ON public.shipments(tracking_code);
CREATE INDEX idx_shipments_delivery_status ON public.shipments(delivery_status);
CREATE UNIQUE INDEX idx_shipments_order_tracking ON public.shipments(order_id, tracking_code);

CREATE INDEX idx_shipment_events_shipment_id ON public.shipment_events(shipment_id);
CREATE INDEX idx_shipment_events_tenant_id ON public.shipment_events(tenant_id);

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipments
CREATE POLICY "Users can view shipments for their tenant"
  ON public.shipments FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert shipments for their tenant"
  ON public.shipments FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update shipments for their tenant"
  ON public.shipments FOR UPDATE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can delete shipments for their tenant"
  ON public.shipments FOR DELETE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- RLS Policies for shipment_events
CREATE POLICY "Users can view shipment events for their tenant"
  ON public.shipment_events FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert shipment events for their tenant"
  ON public.shipment_events FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for shipments
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;