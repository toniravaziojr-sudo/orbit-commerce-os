
-- =============================================
-- Fase 8: Google Tag Manager
-- =============================================

-- Tabela de containers do Tag Manager
CREATE TABLE public.google_tag_manager_containers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  account_name TEXT,
  container_id TEXT NOT NULL,
  container_name TEXT NOT NULL,
  container_public_id TEXT,
  domain_name TEXT[] DEFAULT '{}',
  usage_context TEXT[] DEFAULT '{}',
  tag_manager_url TEXT,
  fingerprint TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, account_id, container_id)
);

-- RLS
ALTER TABLE public.google_tag_manager_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant GTM containers"
  ON public.google_tag_manager_containers FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert their tenant GTM containers"
  ON public.google_tag_manager_containers FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update their tenant GTM containers"
  ON public.google_tag_manager_containers FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete their tenant GTM containers"
  ON public.google_tag_manager_containers FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_google_tag_manager_containers_updated_at
  BEFORE UPDATE ON public.google_tag_manager_containers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_gtm_containers_tenant ON public.google_tag_manager_containers(tenant_id);
CREATE INDEX idx_gtm_containers_active ON public.google_tag_manager_containers(tenant_id, is_active);
