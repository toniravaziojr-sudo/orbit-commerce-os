-- =============================================
-- AI LANDING PAGES - Módulo de geração de LPs com IA
-- Separado do builder, usa v0 Platform API
-- =============================================

-- Tabela principal de landing pages geradas por IA
CREATE TABLE public.ai_landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  
  -- Contexto da geração
  reference_url TEXT, -- URL de referência opcional
  reference_screenshot_url TEXT, -- Screenshot da referência
  product_ids UUID[] DEFAULT '{}', -- Produtos selecionados
  initial_prompt TEXT, -- Prompt inicial do usuário
  
  -- Conteúdo gerado
  generated_html TEXT, -- HTML gerado pela IA
  generated_css TEXT, -- CSS customizado (se houver)
  preview_url TEXT, -- URL de preview (v0)
  
  -- Versões e histórico
  current_version INTEGER DEFAULT 1,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'published', 'archived')),
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_image_url TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique slug por tenant
  CONSTRAINT ai_landing_pages_tenant_slug_unique UNIQUE (tenant_id, slug)
);

-- Tabela de histórico de prompts e versões
CREATE TABLE public.ai_landing_page_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.ai_landing_pages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL, -- Prompt que gerou esta versão
  prompt_type TEXT NOT NULL DEFAULT 'adjustment' CHECK (prompt_type IN ('initial', 'adjustment', 'regenerate')),
  
  -- Conteúdo
  html_content TEXT NOT NULL,
  css_content TEXT,
  preview_url TEXT,
  
  -- Metadados da geração
  generation_metadata JSONB DEFAULT '{}', -- tempo, tokens, etc.
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Índices para performance
CREATE INDEX idx_ai_landing_pages_tenant ON public.ai_landing_pages(tenant_id);
CREATE INDEX idx_ai_landing_pages_status ON public.ai_landing_pages(tenant_id, status);
CREATE INDEX idx_ai_landing_pages_slug ON public.ai_landing_pages(tenant_id, slug);
CREATE INDEX idx_ai_landing_page_versions_page ON public.ai_landing_page_versions(landing_page_id);

-- Enable RLS
ALTER TABLE public.ai_landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_landing_page_versions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ai_landing_pages
CREATE POLICY "Users can view their tenant landing pages"
ON public.ai_landing_pages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = ai_landing_pages.tenant_id
  )
);

CREATE POLICY "Users can create landing pages for their tenant"
ON public.ai_landing_pages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = ai_landing_pages.tenant_id
  )
);

CREATE POLICY "Users can update their tenant landing pages"
ON public.ai_landing_pages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = ai_landing_pages.tenant_id
  )
);

CREATE POLICY "Users can delete their tenant landing pages"
ON public.ai_landing_pages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = ai_landing_pages.tenant_id
  )
);

-- Políticas RLS para ai_landing_page_versions
CREATE POLICY "Users can view their tenant landing page versions"
ON public.ai_landing_page_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = ai_landing_page_versions.tenant_id
  )
);

CREATE POLICY "Users can create landing page versions for their tenant"
ON public.ai_landing_page_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = ai_landing_page_versions.tenant_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_ai_landing_pages_updated_at
BEFORE UPDATE ON public.ai_landing_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Política pública para acesso às landing pages publicadas (storefront)
CREATE POLICY "Public can view published landing pages"
ON public.ai_landing_pages
FOR SELECT
USING (is_published = true AND status = 'published');