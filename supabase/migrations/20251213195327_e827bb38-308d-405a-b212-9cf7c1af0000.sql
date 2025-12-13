
-- =============================================
-- ETAPA 1: Fundação do Storefront + Admin mínimo
-- =============================================

-- 1. Adicionar campos SEO em categories (se não existirem)
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_description text;

-- 2. Adicionar campos type e status em store_pages
ALTER TABLE public.store_pages 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'institutional',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Atualizar páginas existentes para ter status baseado em is_published
UPDATE public.store_pages 
SET status = CASE WHEN is_published = true THEN 'published' ELSE 'draft' END
WHERE status IS NULL OR status = 'draft';

-- 3. Criar tabela menus
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NOT NULL DEFAULT 'header', -- 'header' | 'footer'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, location)
);

-- 4. Criar tabela menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  label text NOT NULL,
  item_type text NOT NULL DEFAULT 'category', -- 'category' | 'page' | 'external'
  ref_id uuid, -- category_id ou page_id
  url text, -- para links externos
  sort_order integer DEFAULT 0,
  parent_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Criar tabela storefront_templates
CREATE TABLE IF NOT EXISTS public.storefront_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_type text NOT NULL, -- 'home' | 'category' | 'product' | 'cart' | 'checkout'
  template_json jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, page_type)
);

-- 6. Enable RLS
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_templates ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies para menus

-- Público pode ler menus de lojas publicadas
CREATE POLICY "Anyone can view menus of published stores"
ON public.menus FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings ss 
    WHERE ss.tenant_id = menus.tenant_id 
    AND ss.is_published = true
  )
);

-- Admins podem gerenciar menus do seu tenant
CREATE POLICY "Admins can manage menus"
ON public.menus FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- 8. RLS Policies para menu_items

-- Público pode ler items de menus de lojas publicadas
CREATE POLICY "Anyone can view menu items of published stores"
ON public.menu_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings ss 
    WHERE ss.tenant_id = menu_items.tenant_id 
    AND ss.is_published = true
  )
);

-- Admins podem gerenciar items do seu tenant
CREATE POLICY "Admins can manage menu items"
ON public.menu_items FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- 9. RLS Policies para storefront_templates

-- Público pode ler templates de lojas publicadas
CREATE POLICY "Anyone can view templates of published stores"
ON public.storefront_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings ss 
    WHERE ss.tenant_id = storefront_templates.tenant_id 
    AND ss.is_published = true
  )
);

-- Admins podem gerenciar templates do seu tenant
CREATE POLICY "Admins can manage templates"
ON public.storefront_templates FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- 10. Triggers para updated_at
CREATE TRIGGER update_menus_updated_at
BEFORE UPDATE ON public.menus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storefront_templates_updated_at
BEFORE UPDATE ON public.storefront_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Índices para performance
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON public.menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_order ON public.menu_items(menu_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_storefront_templates_tenant_type ON public.storefront_templates(tenant_id, page_type);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug_tenant ON public.categories(tenant_id, slug);
