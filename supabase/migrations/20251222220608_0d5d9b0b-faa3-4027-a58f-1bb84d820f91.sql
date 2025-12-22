
-- Adicionar campos para controle de polling na tabela shipments
ALTER TABLE public.shipments 
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_poll_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS poll_error_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_poll_error TEXT;

-- Criar índice para buscar remessas ativas para polling
CREATE INDEX IF NOT EXISTS idx_shipments_polling 
  ON public.shipments (tenant_id, next_poll_at) 
  WHERE delivery_status NOT IN ('delivered', 'returned', 'canceled');

-- Criar tabela para credenciais de integração de transportadoras por tenant
CREATE TABLE IF NOT EXISTS public.tenant_shipping_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  carrier TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, carrier)
);

-- RLS para tenant_shipping_integrations (restrito a owner/admin)
ALTER TABLE public.tenant_shipping_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_shipping_integrations_select" ON public.tenant_shipping_integrations
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "tenant_shipping_integrations_insert" ON public.tenant_shipping_integrations
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "tenant_shipping_integrations_update" ON public.tenant_shipping_integrations
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "tenant_shipping_integrations_delete" ON public.tenant_shipping_integrations
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_tenant_shipping_integrations_updated_at
  BEFORE UPDATE ON public.tenant_shipping_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar provider_event_id em shipment_events se não existir (para idempotência)
ALTER TABLE public.shipment_events 
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

-- Índice para dedupe de eventos
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_events_dedupe 
  ON public.shipment_events (shipment_id, provider_event_id) 
  WHERE provider_event_id IS NOT NULL;
