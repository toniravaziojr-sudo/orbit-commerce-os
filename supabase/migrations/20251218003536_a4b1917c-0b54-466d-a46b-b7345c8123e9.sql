-- Tabela de regras de ofertas (Cross-sell, Order Bump, Upsell)
CREATE TABLE public.offer_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Identificação da regra
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cross_sell', 'order_bump', 'upsell')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Condições
  trigger_product_ids UUID[] DEFAULT '{}',
  min_order_value NUMERIC(10,2) DEFAULT NULL,
  customer_type TEXT DEFAULT 'all' CHECK (customer_type IN ('all', 'new', 'returning')),
  
  -- Ação / Oferta
  suggested_product_ids UUID[] NOT NULL DEFAULT '{}',
  title TEXT,
  description TEXT,
  discount_type TEXT DEFAULT 'none' CHECK (discount_type IN ('none', 'percent', 'fixed')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  
  -- Específico para Order Bump
  default_checked BOOLEAN DEFAULT false,
  max_items INTEGER DEFAULT 4,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_offer_rules_tenant ON public.offer_rules(tenant_id);
CREATE INDEX idx_offer_rules_type ON public.offer_rules(tenant_id, type);
CREATE INDEX idx_offer_rules_active ON public.offer_rules(tenant_id, is_active);

-- RLS
ALTER TABLE public.offer_rules ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas usuários do tenant podem ver/editar
CREATE POLICY "Users can view their tenant offer rules"
ON public.offer_rules FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert offer rules for their tenant"
ON public.offer_rules FOR INSERT
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update their tenant offer rules"
ON public.offer_rules FOR UPDATE
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can delete their tenant offer rules"
ON public.offer_rules FOR DELETE
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Trigger para updated_at
CREATE TRIGGER update_offer_rules_updated_at
BEFORE UPDATE ON public.offer_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();