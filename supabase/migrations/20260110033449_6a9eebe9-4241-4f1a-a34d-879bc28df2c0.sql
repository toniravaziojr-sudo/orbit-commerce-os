-- =====================================================
-- MERCADO LIVRE INTEGRATION - Fase 1: Infrastructure
-- =====================================================

-- Tabela de conexões de marketplace por tenant (multi-tenant tokens)
CREATE TABLE public.marketplace_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL DEFAULT 'mercadolivre',
  
  -- Identificação do vendedor no marketplace
  external_user_id TEXT NOT NULL,
  external_username TEXT,
  
  -- OAuth Tokens (criptografados em produção)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  
  -- Escopos concedidos
  scopes TEXT[],
  
  -- Status e metadados
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: um tenant só pode ter uma conexão por marketplace
  CONSTRAINT unique_tenant_marketplace UNIQUE (tenant_id, marketplace)
);

-- Habilitar RLS
ALTER TABLE public.marketplace_connections ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: tenant pode ver/gerenciar suas próprias conexões
CREATE POLICY "Tenant pode ver suas conexões" 
ON public.marketplace_connections 
FOR SELECT 
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

CREATE POLICY "Tenant pode inserir suas conexões" 
ON public.marketplace_connections 
FOR INSERT 
WITH CHECK (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Tenant pode atualizar suas conexões" 
ON public.marketplace_connections 
FOR UPDATE 
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Tenant pode deletar suas conexões" 
ON public.marketplace_connections 
FOR DELETE 
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
  )
);

-- Índices para performance
CREATE INDEX idx_marketplace_connections_tenant ON public.marketplace_connections(tenant_id);
CREATE INDEX idx_marketplace_connections_marketplace ON public.marketplace_connections(marketplace);
CREATE INDEX idx_marketplace_connections_external_user ON public.marketplace_connections(external_user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_marketplace_connections_updated_at
BEFORE UPDATE ON public.marketplace_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Tabela de logs de sync do marketplace
-- =====================================================
CREATE TABLE public.marketplace_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL, -- 'orders', 'questions', 'messages', 'listings'
  status TEXT NOT NULL DEFAULT 'started', -- 'started', 'completed', 'failed'
  
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  
  error_message TEXT,
  details JSONB DEFAULT '{}',
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.marketplace_sync_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: tenant pode ver seus logs
CREATE POLICY "Tenant pode ver seus logs de sync" 
ON public.marketplace_sync_logs 
FOR SELECT 
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- Índices
CREATE INDEX idx_marketplace_sync_logs_connection ON public.marketplace_sync_logs(connection_id);
CREATE INDEX idx_marketplace_sync_logs_tenant ON public.marketplace_sync_logs(tenant_id);
CREATE INDEX idx_marketplace_sync_logs_type ON public.marketplace_sync_logs(sync_type);

-- =====================================================
-- Adicionar campo source em orders para identificar origem
-- =====================================================
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS marketplace_source TEXT,
ADD COLUMN IF NOT EXISTS marketplace_order_id TEXT,
ADD COLUMN IF NOT EXISTS marketplace_data JSONB DEFAULT '{}';

-- Índice para buscar pedidos por marketplace
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON public.orders(marketplace_source) WHERE marketplace_source IS NOT NULL;