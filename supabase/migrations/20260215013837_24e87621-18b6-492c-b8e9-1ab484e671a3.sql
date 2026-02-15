
-- =============================================
-- FASE 3: TikTok Shop Connections
-- Tabela independente para TikTok Shop (Seller API)
-- =============================================

CREATE TABLE public.tiktok_shop_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_by UUID DEFAULT NULL,
  
  -- TikTok Shop identifiers
  shop_id TEXT DEFAULT NULL,
  shop_name TEXT DEFAULT NULL,
  shop_region TEXT DEFAULT NULL,
  seller_id TEXT DEFAULT NULL,
  
  -- OAuth tokens
  access_token TEXT DEFAULT NULL,
  refresh_token TEXT DEFAULT NULL,
  token_expires_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Scope packs
  scope_packs TEXT[] DEFAULT ARRAY['catalog']::TEXT[],
  granted_scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  last_error TEXT DEFAULT NULL,
  connected_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Assets discovered
  assets JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One connection per tenant
  CONSTRAINT tiktok_shop_connections_tenant_unique UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.tiktok_shop_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant shop connection"
  ON public.tiktok_shop_connections FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert their tenant shop connection"
  ON public.tiktok_shop_connections FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update their tenant shop connection"
  ON public.tiktok_shop_connections FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete their tenant shop connection"
  ON public.tiktok_shop_connections FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Service role full access
CREATE POLICY "Service role full access to tiktok_shop_connections"
  ON public.tiktok_shop_connections FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_tiktok_shop_connections_updated_at
  BEFORE UPDATE ON public.tiktok_shop_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_tiktok_shop_connections_tenant ON public.tiktok_shop_connections(tenant_id);
