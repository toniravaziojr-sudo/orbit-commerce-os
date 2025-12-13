-- Tabela de categorias
CREATE TABLE public.categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

-- Tabela de produtos
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    
    -- Precificação
    cost_price DECIMAL(12,2),
    price DECIMAL(12,2) NOT NULL,
    compare_at_price DECIMAL(12,2),
    promotion_start_date TIMESTAMP WITH TIME ZONE,
    promotion_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Estoque
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    manage_stock BOOLEAN DEFAULT true,
    allow_backorder BOOLEAN DEFAULT false,
    
    -- Físico
    weight DECIMAL(10,3),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    depth DECIMAL(10,2),
    
    -- Identificadores
    barcode TEXT,
    gtin TEXT,
    ncm TEXT,
    
    -- SEO
    seo_title TEXT,
    seo_description TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
    is_featured BOOLEAN DEFAULT false,
    
    -- Variações
    has_variants BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, slug)
);

-- Tabela de relação produto-categoria
CREATE TABLE public.product_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(product_id, category_id)
);

-- Tabela de imagens do produto
CREATE TABLE public.product_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID,
    url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de variantes do produto
CREATE TABLE public.product_variants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    
    -- Opções (ex: "Azul / M")
    option1_name TEXT,
    option1_value TEXT,
    option2_name TEXT,
    option2_value TEXT,
    option3_name TEXT,
    option3_value TEXT,
    
    -- Precificação (sobrescreve o produto pai se preenchido)
    cost_price DECIMAL(12,2),
    price DECIMAL(12,2),
    compare_at_price DECIMAL(12,2),
    promotion_start_date TIMESTAMP WITH TIME ZONE,
    promotion_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Estoque
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    
    -- Físico
    weight DECIMAL(10,3),
    
    -- Identificadores
    barcode TEXT,
    gtin TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    UNIQUE(product_id, sku)
);

-- Adicionar FK na product_images para variant_id
ALTER TABLE public.product_images 
ADD CONSTRAINT product_images_variant_id_fkey 
FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;

-- Índices para performance
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_sku ON public.products(tenant_id, sku);
CREATE INDEX idx_categories_tenant_id ON public.categories(tenant_id);
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies para categories
CREATE POLICY "Users can view categories of their tenants"
ON public.categories FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert categories"
ON public.categories FOR INSERT
WITH CHECK (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin') OR 
    has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can update categories"
ON public.categories FOR UPDATE
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin') OR 
    has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can delete categories"
ON public.categories FOR DELETE
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin')
);

-- RLS Policies para products
CREATE POLICY "Users can view products of their tenants"
ON public.products FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
WITH CHECK (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin') OR 
    has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin') OR 
    has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin')
);

-- RLS Policies para product_categories (via join com products)
CREATE POLICY "Users can view product_categories"
ON public.product_categories FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id 
        AND user_belongs_to_tenant(auth.uid(), p.tenant_id)
    )
);

CREATE POLICY "Admins can manage product_categories"
ON public.product_categories FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id 
        AND (has_role(auth.uid(), p.tenant_id, 'owner') OR has_role(auth.uid(), p.tenant_id, 'admin') OR has_role(auth.uid(), p.tenant_id, 'operator'))
    )
);

-- RLS Policies para product_images
CREATE POLICY "Users can view product_images"
ON public.product_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id 
        AND user_belongs_to_tenant(auth.uid(), p.tenant_id)
    )
);

CREATE POLICY "Admins can manage product_images"
ON public.product_images FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id 
        AND (has_role(auth.uid(), p.tenant_id, 'owner') OR has_role(auth.uid(), p.tenant_id, 'admin') OR has_role(auth.uid(), p.tenant_id, 'operator'))
    )
);

-- RLS Policies para product_variants
CREATE POLICY "Users can view product_variants"
ON public.product_variants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id 
        AND user_belongs_to_tenant(auth.uid(), p.tenant_id)
    )
);

CREATE POLICY "Admins can manage product_variants"
ON public.product_variants FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id 
        AND (has_role(auth.uid(), p.tenant_id, 'owner') OR has_role(auth.uid(), p.tenant_id, 'admin') OR has_role(auth.uid(), p.tenant_id, 'operator'))
    )
);

-- Triggers para updated_at
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();