-- Create product_badges table for managing product seals/badges
CREATE TABLE public.product_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  background_color TEXT NOT NULL DEFAULT '#F59E0B',
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  shape TEXT NOT NULL DEFAULT 'rectangular' CHECK (shape IN ('square', 'rectangular', 'circular', 'pill')),
  position TEXT NOT NULL DEFAULT 'left' CHECK (position IN ('left', 'center', 'right')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for product-badge associations
CREATE TABLE public.product_badge_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.product_badges(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.product_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_badge_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_badges
CREATE POLICY "Users can view badges for their tenant" 
ON public.product_badges 
FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create badges for their tenant" 
ON public.product_badges 
FOR INSERT 
WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update badges for their tenant" 
ON public.product_badges 
FOR UPDATE 
USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete badges for their tenant" 
ON public.product_badges 
FOR DELETE 
USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

-- RLS Policies for product_badge_assignments
CREATE POLICY "Users can view badge assignments for their tenant" 
ON public.product_badge_assignments 
FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create badge assignments for their tenant" 
ON public.product_badge_assignments 
FOR INSERT 
WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete badge assignments for their tenant" 
ON public.product_badge_assignments 
FOR DELETE 
USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

-- Public read access for storefront
CREATE POLICY "Public can view active badges" 
ON public.product_badges 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Public can view badge assignments" 
ON public.product_badge_assignments 
FOR SELECT 
USING (true);

-- Create indexes
CREATE INDEX idx_product_badges_tenant ON public.product_badges(tenant_id);
CREATE INDEX idx_product_badges_active ON public.product_badges(is_active);
CREATE INDEX idx_product_badge_assignments_product ON public.product_badge_assignments(product_id);
CREATE INDEX idx_product_badge_assignments_badge ON public.product_badge_assignments(badge_id);

-- Trigger for updated_at
CREATE TRIGGER update_product_badges_updated_at
BEFORE UPDATE ON public.product_badges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();