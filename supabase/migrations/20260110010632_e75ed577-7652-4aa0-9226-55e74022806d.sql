-- =============================================
-- SHIPPING RULES TABLES
-- Tables for custom shipping rules (free shipping and custom pricing)
-- =============================================

-- 1) FREE SHIPPING RULES
CREATE TABLE public.shipping_free_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  region_type TEXT NOT NULL CHECK (region_type IN ('capital', 'interior')),
  cep_start TEXT NOT NULL,
  cep_end TEXT NOT NULL,
  uf TEXT NULL,
  min_order_cents INTEGER NULL,
  delivery_days_min INTEGER NULL,
  delivery_days_max INTEGER NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) CUSTOM SHIPPING RULES (with price)
CREATE TABLE public.shipping_custom_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  region_type TEXT NOT NULL CHECK (region_type IN ('capital', 'interior')),
  cep_start TEXT NOT NULL,
  cep_end TEXT NOT NULL,
  uf TEXT NULL,
  min_order_cents INTEGER NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  delivery_days_min INTEGER NULL,
  delivery_days_max INTEGER NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

-- Free rules indexes
CREATE INDEX idx_shipping_free_rules_tenant_enabled ON public.shipping_free_rules(tenant_id, is_enabled);
CREATE INDEX idx_shipping_free_rules_cep_range ON public.shipping_free_rules(tenant_id, cep_start, cep_end);
CREATE INDEX idx_shipping_free_rules_sort ON public.shipping_free_rules(tenant_id, sort_order);

-- Custom rules indexes
CREATE INDEX idx_shipping_custom_rules_tenant_enabled ON public.shipping_custom_rules(tenant_id, is_enabled);
CREATE INDEX idx_shipping_custom_rules_cep_range ON public.shipping_custom_rules(tenant_id, cep_start, cep_end);
CREATE INDEX idx_shipping_custom_rules_sort ON public.shipping_custom_rules(tenant_id, sort_order);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.shipping_free_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_custom_rules ENABLE ROW LEVEL SECURITY;

-- Free rules: SELECT
CREATE POLICY "Users can view their tenant free shipping rules"
ON public.shipping_free_rules
FOR SELECT
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- Free rules: INSERT
CREATE POLICY "Users can create free shipping rules for their tenant"
ON public.shipping_free_rules
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- Free rules: UPDATE
CREATE POLICY "Users can update their tenant free shipping rules"
ON public.shipping_free_rules
FOR UPDATE
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- Free rules: DELETE
CREATE POLICY "Users can delete their tenant free shipping rules"
ON public.shipping_free_rules
FOR DELETE
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- Custom rules: SELECT
CREATE POLICY "Users can view their tenant custom shipping rules"
ON public.shipping_custom_rules
FOR SELECT
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- Custom rules: INSERT
CREATE POLICY "Users can create custom shipping rules for their tenant"
ON public.shipping_custom_rules
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- Custom rules: UPDATE
CREATE POLICY "Users can update their tenant custom shipping rules"
ON public.shipping_custom_rules
FOR UPDATE
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- Custom rules: DELETE
CREATE POLICY "Users can delete their tenant custom shipping rules"
ON public.shipping_custom_rules
FOR DELETE
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- =============================================
-- PUBLIC READ POLICIES FOR CHECKOUT
-- Allow anonymous/public read for checkout shipping calculation
-- =============================================

CREATE POLICY "Public can read enabled free shipping rules for checkout"
ON public.shipping_free_rules
FOR SELECT
USING (is_enabled = true);

CREATE POLICY "Public can read enabled custom shipping rules for checkout"
ON public.shipping_custom_rules
FOR SELECT
USING (is_enabled = true);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_shipping_free_rules_updated_at
BEFORE UPDATE ON public.shipping_free_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_custom_rules_updated_at
BEFORE UPDATE ON public.shipping_custom_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();