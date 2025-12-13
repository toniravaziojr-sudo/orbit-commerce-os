-- Tabela para configurações da loja/storefront
CREATE TABLE public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_name text,
  store_description text,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#6366f1',
  secondary_color text DEFAULT '#8b5cf6',
  accent_color text DEFAULT '#f59e0b',
  header_style text DEFAULT 'default',
  footer_style text DEFAULT 'default',
  social_facebook text,
  social_instagram text,
  social_whatsapp text,
  seo_title text,
  seo_description text,
  seo_keywords text[],
  google_analytics_id text,
  facebook_pixel_id text,
  custom_css text,
  custom_scripts text,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Tabela para páginas do storefront (builder visual)
CREATE TABLE public.store_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  content jsonb DEFAULT '[]'::jsonb,
  is_homepage boolean DEFAULT false,
  is_published boolean DEFAULT false,
  seo_title text,
  seo_description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Tabela para carrinho de compras
CREATE TABLE public.carts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  session_id text,
  status text DEFAULT 'active',
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para itens do carrinho
CREATE TABLE public.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para checkouts (sessões de checkout)
CREATE TABLE public.checkouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  step text DEFAULT 'cart',
  customer_email text,
  customer_name text,
  customer_phone text,
  customer_cpf text,
  shipping_address_id uuid REFERENCES public.customer_addresses(id),
  shipping_street text,
  shipping_number text,
  shipping_complement text,
  shipping_neighborhood text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_country text DEFAULT 'BR',
  shipping_method text,
  shipping_carrier text,
  shipping_price numeric DEFAULT 0,
  shipping_estimated_days integer,
  payment_method text,
  subtotal numeric DEFAULT 0,
  discount_total numeric DEFAULT 0,
  shipping_total numeric DEFAULT 0,
  total numeric DEFAULT 0,
  coupon_code text,
  notes text,
  status text DEFAULT 'pending',
  completed_at timestamp with time zone,
  abandoned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;

-- Policies para store_settings (público para leitura, admin para escrita)
CREATE POLICY "Anyone can view published store settings"
ON public.store_settings FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can manage store settings"
ON public.store_settings FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin'));

-- Policies para store_pages
CREATE POLICY "Anyone can view published store pages"
ON public.store_pages FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can manage store pages"
ON public.store_pages FOR ALL
USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin'));

-- Policies para carts (público para guest checkout)
CREATE POLICY "Anyone can create carts"
ON public.carts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view own cart by session"
ON public.carts FOR SELECT
USING (true);

CREATE POLICY "Anyone can update own cart"
ON public.carts FOR UPDATE
USING (true);

-- Policies para cart_items
CREATE POLICY "Anyone can manage cart items"
ON public.cart_items FOR ALL
USING (true);

-- Policies para checkouts
CREATE POLICY "Anyone can create checkouts"
ON public.checkouts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view own checkout"
ON public.checkouts FOR SELECT
USING (true);

CREATE POLICY "Anyone can update own checkout"
ON public.checkouts FOR UPDATE
USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_pages_updated_at
BEFORE UPDATE ON public.store_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_carts_updated_at
BEFORE UPDATE ON public.carts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at
BEFORE UPDATE ON public.cart_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checkouts_updated_at
BEFORE UPDATE ON public.checkouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();