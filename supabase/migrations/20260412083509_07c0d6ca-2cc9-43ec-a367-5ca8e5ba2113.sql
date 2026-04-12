-- Table: audience_sync_mappings
CREATE TABLE public.audience_sync_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.email_marketing_lists(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  platform_audience_id TEXT,
  ad_account_id TEXT,
  audience_name TEXT,
  last_synced_at TIMESTAMPTZ,
  members_synced INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audience_sync_mappings_unique UNIQUE (tenant_id, list_id, platform)
);

ALTER TABLE public.audience_sync_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view audience sync mappings"
  ON public.audience_sync_mappings FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id) OR is_platform_admin_by_auth());

CREATE TRIGGER update_audience_sync_mappings_updated_at
  BEFORE UPDATE ON public.audience_sync_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: audience_sync_logs
CREATE TABLE public.audience_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  list_id UUID REFERENCES public.email_marketing_lists(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  platform_audience_id TEXT,
  action TEXT NOT NULL DEFAULT 'sync' CHECK (action IN ('create', 'sync', 'rename', 'error')),
  members_sent INTEGER DEFAULT 0,
  members_matched INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view audience sync logs"
  ON public.audience_sync_logs FOR SELECT TO authenticated
  USING (user_has_tenant_access(tenant_id) OR is_platform_admin_by_auth());

CREATE INDEX idx_audience_sync_logs_tenant_created ON public.audience_sync_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audience_sync_mappings_tenant ON public.audience_sync_mappings(tenant_id);