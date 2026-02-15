
-- =============================================
-- Fase 4: TikTok Content Connections (Login Kit)
-- =============================================

CREATE TABLE public.tiktok_content_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_by UUID NOT NULL,
  
  -- TikTok user info
  open_id TEXT,
  union_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  
  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  
  -- Scopes & config
  scope_packs TEXT[] DEFAULT '{content}',
  granted_scopes TEXT[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'disconnected',
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  
  -- Metadata
  assets JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT tiktok_content_connections_tenant_id_key UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE public.tiktok_content_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their content connections"
  ON public.tiktok_content_connections FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert content connections"
  ON public.tiktok_content_connections FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update their content connections"
  ON public.tiktok_content_connections FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete their content connections"
  ON public.tiktok_content_connections FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_tiktok_content_connections_updated_at
  BEFORE UPDATE ON public.tiktok_content_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_tiktok_content_connections_tenant ON public.tiktok_content_connections(tenant_id);
