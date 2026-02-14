
-- =====================================================
-- Google Hub Centralizado - Fase 1: Tabelas Base
-- =====================================================

-- Tabela google_connections (1 por tenant, OAuth centralizado)
CREATE TABLE public.google_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_by UUID NOT NULL,
  google_user_id TEXT,
  google_email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope_packs TEXT[] DEFAULT '{}',
  granted_scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'connected',
  last_error TEXT,
  last_sync_at TIMESTAMPTZ,
  assets JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_connections_tenant_unique UNIQUE (tenant_id)
);

-- Tabela google_oauth_states (anti-CSRF)
CREATE TABLE public.google_oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  scope_packs TEXT[] DEFAULT '{}',
  return_path TEXT DEFAULT '/integrations',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

-- Policies google_connections
CREATE POLICY "Users can view their tenant google connections"
  ON public.google_connections FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can insert google connections"
  ON public.google_connections FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can update google connections"
  ON public.google_connections FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Admins can delete google connections"
  ON public.google_connections FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Policies google_oauth_states
CREATE POLICY "Users can view their own google oauth states"
  ON public.google_oauth_states FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert google oauth states"
  ON public.google_oauth_states FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete google oauth states"
  ON public.google_oauth_states FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Cleanup function para states expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_google_oauth_states()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.google_oauth_states
  WHERE expires_at < now() - interval '1 hour';
END;
$$;
