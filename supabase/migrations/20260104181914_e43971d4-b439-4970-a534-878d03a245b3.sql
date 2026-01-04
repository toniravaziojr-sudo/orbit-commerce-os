-- Create checkout_testimonials table for custom testimonials
CREATE TABLE public.checkout_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for testimonial-product relationships
CREATE TABLE public.checkout_testimonial_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  testimonial_id UUID NOT NULL REFERENCES public.checkout_testimonials(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  UNIQUE(testimonial_id, product_id)
);

-- Enable RLS
ALTER TABLE public.checkout_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_testimonial_products ENABLE ROW LEVEL SECURITY;

-- RLS policies for checkout_testimonials
CREATE POLICY "Users can view testimonials for their tenant" 
ON public.checkout_testimonials 
FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert testimonials for their tenant" 
ON public.checkout_testimonials 
FOR INSERT 
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update testimonials for their tenant" 
ON public.checkout_testimonials 
FOR UPDATE 
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete testimonials for their tenant" 
ON public.checkout_testimonials 
FOR DELETE 
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS policies for checkout_testimonial_products
CREATE POLICY "Users can view testimonial products for their tenant" 
ON public.checkout_testimonial_products 
FOR SELECT 
USING (testimonial_id IN (SELECT id FROM public.checkout_testimonials WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert testimonial products for their tenant" 
ON public.checkout_testimonial_products 
FOR INSERT 
WITH CHECK (testimonial_id IN (SELECT id FROM public.checkout_testimonials WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can delete testimonial products for their tenant" 
ON public.checkout_testimonial_products 
FOR DELETE 
USING (testimonial_id IN (SELECT id FROM public.checkout_testimonials WHERE tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())));

-- Anon policy for storefront reading active testimonials
CREATE POLICY "Anon can read active testimonials" 
ON public.checkout_testimonials 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Anon can read testimonial products" 
ON public.checkout_testimonial_products 
FOR SELECT 
USING (true);

-- Index for performance
CREATE INDEX idx_checkout_testimonials_tenant ON public.checkout_testimonials(tenant_id);
CREATE INDEX idx_checkout_testimonials_active ON public.checkout_testimonials(tenant_id, is_active);
CREATE INDEX idx_checkout_testimonial_products_testimonial ON public.checkout_testimonial_products(testimonial_id);
CREATE INDEX idx_checkout_testimonial_products_product ON public.checkout_testimonial_products(product_id);

-- Trigger for updated_at
CREATE TRIGGER update_checkout_testimonials_updated_at
BEFORE UPDATE ON public.checkout_testimonials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();