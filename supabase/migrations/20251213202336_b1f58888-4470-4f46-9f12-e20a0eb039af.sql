-- =============================================
-- ETAPA 2: BUILDER VISUAL - MODELO DE DADOS
-- =============================================

-- 1. Tabela de versões de páginas/templates
CREATE TABLE public.store_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('page', 'template')),
  page_id uuid REFERENCES public.store_pages(id) ON DELETE CASCADE,
  page_type text CHECK (page_type IN ('home', 'category', 'product', 'cart', 'checkout')),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  content jsonb NOT NULL DEFAULT '{"id": "root", "type": "Page", "props": {}, "children": []}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraint: page_id required for entity_type 'page', page_type required for 'template'
  CONSTRAINT valid_entity CHECK (
    (entity_type = 'page' AND page_id IS NOT NULL) OR
    (entity_type = 'template' AND page_type IS NOT NULL AND page_id IS NULL)
  )
);

-- Unique indexes para garantir unicidade
CREATE UNIQUE INDEX idx_unique_page_version 
  ON public.store_page_versions (tenant_id, page_id, version) 
  WHERE entity_type = 'page';

CREATE UNIQUE INDEX idx_unique_template_version 
  ON public.store_page_versions (tenant_id, page_type, version) 
  WHERE entity_type = 'template';

-- 2. Adicionar campos de versão na store_pages
ALTER TABLE public.store_pages 
  ADD COLUMN IF NOT EXISTS published_version integer,
  ADD COLUMN IF NOT EXISTS draft_version integer,
  ADD COLUMN IF NOT EXISTS builder_enabled boolean DEFAULT true;

-- 3. Tabela para templates do storefront (Home, Category, Product, Cart, Checkout)
CREATE TABLE public.storefront_page_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_type text NOT NULL CHECK (page_type IN ('home', 'category', 'product', 'cart', 'checkout')),
  published_version integer,
  draft_version integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_template_per_tenant UNIQUE (tenant_id, page_type)
);

-- 4. Índices para performance
CREATE INDEX idx_store_page_versions_tenant ON public.store_page_versions(tenant_id);
CREATE INDEX idx_store_page_versions_status ON public.store_page_versions(status);
CREATE INDEX idx_store_page_versions_entity ON public.store_page_versions(entity_type, page_id);
CREATE INDEX idx_store_page_versions_template ON public.store_page_versions(entity_type, page_type);
CREATE INDEX idx_storefront_templates_tenant ON public.storefront_page_templates(tenant_id);

-- 5. Trigger para updated_at
CREATE TRIGGER update_store_page_versions_updated_at
  BEFORE UPDATE ON public.store_page_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_storefront_templates_updated_at
  BEFORE UPDATE ON public.storefront_page_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS para store_page_versions
ALTER TABLE public.store_page_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage page versions"
  ON public.store_page_versions
  FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

CREATE POLICY "Anyone can view published versions of published stores"
  ON public.store_page_versions
  FOR SELECT
  USING (
    status = 'published' AND
    EXISTS (
      SELECT 1 FROM store_settings ss 
      WHERE ss.tenant_id = store_page_versions.tenant_id 
      AND ss.is_published = true
    )
  );

-- 7. RLS para storefront_page_templates
ALTER TABLE public.storefront_page_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates"
  ON public.storefront_page_templates
  FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

CREATE POLICY "Anyone can view templates of published stores"
  ON public.storefront_page_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM store_settings ss 
      WHERE ss.tenant_id = storefront_page_templates.tenant_id 
      AND ss.is_published = true
    )
  );

-- 8. Função para inicializar templates default para um tenant
CREATE OR REPLACE FUNCTION public.initialize_storefront_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_page_types text[] := ARRAY['home', 'category', 'product', 'cart', 'checkout'];
  v_type text;
BEGIN
  FOREACH v_type IN ARRAY v_page_types
  LOOP
    INSERT INTO public.storefront_page_templates (tenant_id, page_type)
    VALUES (p_tenant_id, v_type)
    ON CONFLICT (tenant_id, page_type) DO NOTHING;
  END LOOP;
END;
$$;