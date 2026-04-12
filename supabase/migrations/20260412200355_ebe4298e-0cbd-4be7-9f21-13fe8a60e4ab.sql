
-- Create checkout_links table
CREATE TABLE public.checkout_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  coupon_code text,
  shipping_override numeric,
  price_override numeric,
  additional_products jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.checkout_links ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing helper function
CREATE POLICY "Tenant members can view checkout links"
  ON public.checkout_links FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can create checkout links"
  ON public.checkout_links FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update checkout links"
  ON public.checkout_links FOR UPDATE TO authenticated
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can delete checkout links"
  ON public.checkout_links FOR DELETE TO authenticated
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Indexes
CREATE INDEX idx_checkout_links_tenant ON public.checkout_links(tenant_id);
CREATE INDEX idx_checkout_links_slug ON public.checkout_links(tenant_id, slug);

-- Updated_at trigger
CREATE TRIGGER update_checkout_links_updated_at
  BEFORE UPDATE ON public.checkout_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
