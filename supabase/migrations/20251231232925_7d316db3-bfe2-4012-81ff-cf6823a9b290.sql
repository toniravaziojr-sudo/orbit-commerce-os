-- =============================================
-- SISTEMA DE MIGRAÇÃO INTELIGENTE - Fase 1
-- Tabelas: custom_blocks e block_implementation_requests
-- =============================================

-- Tabela custom_blocks: armazena HTML/CSS capturados durante importação
CREATE TABLE public.custom_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  block_type TEXT NOT NULL, -- identificador único: "custom_hero_1234abc"
  name TEXT NOT NULL, -- nome legível: "Hero com Vídeo Lateral"
  html_template TEXT NOT NULL, -- HTML capturado
  css_snapshot TEXT, -- CSS relevante (inline + classes)
  detected_pattern JSONB DEFAULT '{}', -- metadados do padrão detectado
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'deprecated')),
  promoted_to_block TEXT, -- tipo oficial se promovido
  source_url TEXT, -- URL de origem
  source_platform TEXT, -- shopify, nuvemshop, etc
  pattern_hash TEXT, -- hash para dedupe
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para custom_blocks
CREATE INDEX idx_custom_blocks_tenant ON public.custom_blocks(tenant_id);
CREATE INDEX idx_custom_blocks_hash ON public.custom_blocks(pattern_hash);
CREATE INDEX idx_custom_blocks_status ON public.custom_blocks(status);

-- Tabela block_implementation_requests: notificações para admin da plataforma
CREATE TABLE public.block_implementation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  custom_block_id UUID REFERENCES public.custom_blocks(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL, -- nome sugerido
  pattern_description TEXT, -- descrição do padrão
  html_sample TEXT NOT NULL, -- amostra do HTML
  css_sample TEXT, -- amostra do CSS
  source_url TEXT, -- URL de origem
  source_platform TEXT, -- plataforma de origem
  suggested_props JSONB DEFAULT '{}', -- props sugeridas para o bloco
  occurrences_count INT DEFAULT 1, -- quantas vezes padrão foi detectado
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'implemented', 'rejected', 'mapped')),
  implemented_as TEXT, -- tipo do bloco oficial criado
  mapped_to_block TEXT, -- se mapeado para bloco existente
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  implementation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para block_implementation_requests
CREATE INDEX idx_block_requests_status ON public.block_implementation_requests(status);
CREATE INDEX idx_block_requests_tenant ON public.block_implementation_requests(tenant_id);
CREATE INDEX idx_block_requests_custom_block ON public.block_implementation_requests(custom_block_id);

-- Enable RLS
ALTER TABLE public.custom_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_implementation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies para custom_blocks
-- Tenants podem ver seus próprios blocos customizados (via current_tenant_id do profile)
CREATE POLICY "Tenants can view own custom blocks"
ON public.custom_blocks FOR SELECT
USING (
  tenant_id = (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Tenants podem inserir blocos customizados
CREATE POLICY "Tenants can insert own custom blocks"
ON public.custom_blocks FOR INSERT
WITH CHECK (
  tenant_id = (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Tenants podem atualizar seus próprios blocos
CREATE POLICY "Tenants can update own custom blocks"
ON public.custom_blocks FOR UPDATE
USING (
  tenant_id = (SELECT current_tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Service role pode fazer tudo (para edge functions)
CREATE POLICY "Service role full access to custom_blocks"
ON public.custom_blocks FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Acesso público para leitura de custom_blocks ativos (storefront público)
CREATE POLICY "Public can read active custom blocks"
ON public.custom_blocks FOR SELECT
USING (status = 'active');

-- RLS Policies para block_implementation_requests
-- Platform admins podem ver todas as solicitações (usando a função is_platform_admin existente)
CREATE POLICY "Platform admins can view all block requests"
ON public.block_implementation_requests FOR SELECT
USING (public.is_platform_admin());

-- Platform admins podem atualizar solicitações
CREATE POLICY "Platform admins can update block requests"
ON public.block_implementation_requests FOR UPDATE
USING (public.is_platform_admin());

-- Service role pode fazer tudo (para edge functions)
CREATE POLICY "Service role full access to block_requests"
ON public.block_implementation_requests FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger para updated_at em custom_blocks
CREATE TRIGGER update_custom_blocks_updated_at
BEFORE UPDATE ON public.custom_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em block_implementation_requests
CREATE TRIGGER update_block_requests_updated_at
BEFORE UPDATE ON public.block_implementation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();