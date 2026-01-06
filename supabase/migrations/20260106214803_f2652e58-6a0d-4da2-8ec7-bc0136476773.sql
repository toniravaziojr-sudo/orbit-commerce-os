-- ============================================
-- Módulo Gestão de Mídias - Estrutura Base
-- ============================================

-- Enum para status de campanhas de mídia
CREATE TYPE public.media_campaign_status AS ENUM (
  'draft',
  'planning',
  'generating',
  'ready',
  'active',
  'paused',
  'completed',
  'archived'
);

-- Enum para status de itens do calendário
CREATE TYPE public.media_item_status AS ENUM (
  'draft',
  'suggested',
  'review',
  'approved',
  'generating_asset',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'skipped'
);

-- Enum para tipo de conteúdo
CREATE TYPE public.media_content_type AS ENUM (
  'image',
  'video',
  'carousel',
  'story',
  'reel',
  'text'
);

-- Enum para provedores de redes sociais
CREATE TYPE public.social_provider AS ENUM (
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
  'pinterest'
);

-- Enum para status de conexão social
CREATE TYPE public.social_connection_status AS ENUM (
  'disconnected',
  'connecting',
  'connected',
  'error',
  'expired'
);

-- ============================================
-- Tabela: media_campaigns
-- Campanhas de conteúdo orgânico
-- ============================================
CREATE TABLE public.media_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Dados básicos
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL, -- Briefing/objetivo da campanha
  
  -- Período
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Filtros de período
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=domingo, 6=sábado
  months INTEGER[], -- NULL = todos os meses, ou array de 1-12
  excluded_dates DATE[], -- Datas específicas a excluir
  
  -- Status e controle
  status public.media_campaign_status NOT NULL DEFAULT 'draft',
  items_count INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  published_count INTEGER DEFAULT 0,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- ============================================
-- Tabela: media_calendar_items
-- Itens do calendário editorial
-- ============================================
CREATE TABLE public.media_calendar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.media_campaigns(id) ON DELETE CASCADE,
  
  -- Agendamento
  scheduled_date DATE NOT NULL,
  scheduled_time TIME, -- Horário opcional
  
  -- Conteúdo
  content_type public.media_content_type NOT NULL DEFAULT 'image',
  title TEXT,
  copy TEXT, -- Legenda/texto do post
  cta TEXT, -- Call to action
  hashtags TEXT[], -- Hashtags sugeridas
  
  -- Briefing para geração
  generation_prompt TEXT, -- Prompt específico para gerar o asset
  reference_urls TEXT[], -- URLs de referência (imagens, vídeos)
  
  -- Assets gerados
  asset_url TEXT, -- URL do asset final
  asset_thumbnail_url TEXT,
  asset_metadata JSONB DEFAULT '{}',
  
  -- Status e controle
  status public.media_item_status NOT NULL DEFAULT 'draft',
  
  -- Publicação
  target_platforms TEXT[] DEFAULT ARRAY[]::TEXT[], -- Plataformas destino
  published_at TIMESTAMP WITH TIME ZONE,
  publish_results JSONB DEFAULT '{}', -- Resultados por plataforma
  
  -- Versioning
  version INTEGER DEFAULT 1,
  edited_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- Tabela: social_connections
-- Conexões com redes sociais por tenant
-- ============================================
CREATE TABLE public.social_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Provider
  provider public.social_provider NOT NULL,
  provider_account_id TEXT, -- ID da conta no provider
  provider_account_name TEXT, -- Nome/username
  provider_page_id TEXT, -- ID da página (para Facebook/Instagram Business)
  
  -- Auth
  access_token TEXT, -- Token de acesso (encrypted ideally)
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status public.social_connection_status NOT NULL DEFAULT 'disconnected',
  last_error TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Permissões
  scopes TEXT[],
  
  -- Metadados
  profile_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  connected_by UUID REFERENCES auth.users(id),
  
  -- Uma conexão por provider por tenant
  CONSTRAINT unique_tenant_provider UNIQUE (tenant_id, provider)
);

-- ============================================
-- Índices
-- ============================================
CREATE INDEX idx_media_campaigns_tenant ON public.media_campaigns(tenant_id);
CREATE INDEX idx_media_campaigns_status ON public.media_campaigns(tenant_id, status);
CREATE INDEX idx_media_campaigns_dates ON public.media_campaigns(tenant_id, start_date, end_date);

CREATE INDEX idx_media_calendar_items_tenant ON public.media_calendar_items(tenant_id);
CREATE INDEX idx_media_calendar_items_campaign ON public.media_calendar_items(campaign_id);
CREATE INDEX idx_media_calendar_items_date ON public.media_calendar_items(tenant_id, scheduled_date);
CREATE INDEX idx_media_calendar_items_status ON public.media_calendar_items(tenant_id, status);

CREATE INDEX idx_social_connections_tenant ON public.social_connections(tenant_id);
CREATE INDEX idx_social_connections_provider ON public.social_connections(tenant_id, provider);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.media_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- media_campaigns policies
CREATE POLICY "Tenants can view their own campaigns"
  ON public.media_campaigns FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can create their own campaigns"
  ON public.media_campaigns FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can update their own campaigns"
  ON public.media_campaigns FOR UPDATE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can delete their own campaigns"
  ON public.media_campaigns FOR DELETE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- media_calendar_items policies
CREATE POLICY "Tenants can view their own calendar items"
  ON public.media_calendar_items FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can create their own calendar items"
  ON public.media_calendar_items FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can update their own calendar items"
  ON public.media_calendar_items FOR UPDATE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can delete their own calendar items"
  ON public.media_calendar_items FOR DELETE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- social_connections policies
CREATE POLICY "Tenants can view their own social connections"
  ON public.social_connections FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can create their own social connections"
  ON public.social_connections FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can update their own social connections"
  ON public.social_connections FOR UPDATE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenants can delete their own social connections"
  ON public.social_connections FOR DELETE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- ============================================
-- Triggers para updated_at
-- ============================================
CREATE TRIGGER update_media_campaigns_updated_at
  BEFORE UPDATE ON public.media_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_calendar_items_updated_at
  BEFORE UPDATE ON public.media_calendar_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();