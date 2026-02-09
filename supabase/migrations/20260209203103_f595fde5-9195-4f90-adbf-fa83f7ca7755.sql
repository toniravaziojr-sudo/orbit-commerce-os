
-- Table to manage ML listing preparation workflow
CREATE TABLE public.meli_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'approved', 'publishing', 'published', 'error')),
  meli_item_id TEXT, -- ML item ID after publishing
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  category_id TEXT, -- ML category ID
  listing_type TEXT NOT NULL DEFAULT 'gold_special' CHECK (listing_type IN ('gold_special', 'gold_pro', 'gold', 'silver', 'bronze', 'free')),
  condition TEXT NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'used', 'not_specified')),
  currency_id TEXT NOT NULL DEFAULT 'BRL',
  images JSONB DEFAULT '[]'::jsonb,
  attributes JSONB DEFAULT '[]'::jsonb,
  shipping JSONB DEFAULT '{}'::jsonb,
  meli_response JSONB,
  error_message TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meli_listings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view meli_listings for their tenant"
ON public.meli_listings FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create meli_listings for their tenant"
ON public.meli_listings FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update meli_listings for their tenant"
ON public.meli_listings FOR UPDATE
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete meli_listings for their tenant"
ON public.meli_listings FOR DELETE
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Index
CREATE INDEX idx_meli_listings_tenant ON public.meli_listings(tenant_id);
CREATE INDEX idx_meli_listings_product ON public.meli_listings(product_id);
CREATE UNIQUE INDEX idx_meli_listings_tenant_product ON public.meli_listings(tenant_id, product_id);

-- Trigger for updated_at
CREATE TRIGGER update_meli_listings_updated_at
BEFORE UPDATE ON public.meli_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
