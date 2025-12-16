-- =============================================
-- PRODUCT REVIEWS TABLE
-- =============================================
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_verified_purchase BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID
);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for product_reviews
CREATE POLICY "Admins can manage product reviews" ON public.product_reviews
FOR ALL USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role) OR
  has_role(auth.uid(), tenant_id, 'operator'::app_role)
);

CREATE POLICY "Anyone can view approved reviews" ON public.product_reviews
FOR SELECT USING (status = 'approved');

-- Index for efficient queries
CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id, status);
CREATE INDEX idx_product_reviews_tenant ON public.product_reviews(tenant_id, status);

-- =============================================
-- BUY TOGETHER RULES TABLE
-- =============================================
CREATE TABLE public.buy_together_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  suggested_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Compre junto e economize',
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'none')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, trigger_product_id, suggested_product_id)
);

-- Enable RLS
ALTER TABLE public.buy_together_rules ENABLE ROW LEVEL SECURITY;

-- Policies for buy_together_rules
CREATE POLICY "Admins can manage buy together rules" ON public.buy_together_rules
FOR ALL USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role) OR
  has_role(auth.uid(), tenant_id, 'operator'::app_role)
);

CREATE POLICY "Anyone can view active buy together rules" ON public.buy_together_rules
FOR SELECT USING (is_active = true);

-- Index for queries
CREATE INDEX idx_buy_together_trigger ON public.buy_together_rules(trigger_product_id, is_active);
CREATE INDEX idx_buy_together_tenant ON public.buy_together_rules(tenant_id);

-- =============================================
-- RELATED PRODUCTS - Junction Table
-- =============================================
CREATE TABLE public.related_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, related_product_id),
  CHECK (product_id != related_product_id)
);

-- Enable RLS
ALTER TABLE public.related_products ENABLE ROW LEVEL SECURITY;

-- Policies for related_products
CREATE POLICY "Admins can manage related products" ON public.related_products
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = related_products.product_id
    AND (
      has_role(auth.uid(), p.tenant_id, 'owner'::app_role) OR
      has_role(auth.uid(), p.tenant_id, 'admin'::app_role) OR
      has_role(auth.uid(), p.tenant_id, 'operator'::app_role)
    )
  )
);

CREATE POLICY "Anyone can view related products of active products" ON public.related_products
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = related_products.product_id
    AND p.status = 'active'
  )
);

-- Index
CREATE INDEX idx_related_products_product ON public.related_products(product_id);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_buy_together_rules_updated_at
  BEFORE UPDATE ON public.buy_together_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();