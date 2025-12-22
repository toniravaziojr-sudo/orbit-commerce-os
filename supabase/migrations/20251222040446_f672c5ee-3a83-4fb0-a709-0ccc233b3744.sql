-- =============================================
-- STOREFRONT RUNTIME VIOLATIONS: Telemetria de violações de URLs
-- =============================================

CREATE TABLE public.storefront_runtime_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('hardcoded_store_url', 'app_domain_link', 'preview_in_public', 'content_hardcoded_url')),
  details JSONB,
  source TEXT, -- 'runtime', 'scanner', 'build'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_runtime_violations_tenant_created ON public.storefront_runtime_violations(tenant_id, created_at DESC);
CREATE INDEX idx_runtime_violations_type ON public.storefront_runtime_violations(violation_type, created_at DESC);
CREATE INDEX idx_runtime_violations_unresolved ON public.storefront_runtime_violations(tenant_id) WHERE resolved_at IS NULL;

-- RLS
ALTER TABLE public.storefront_runtime_violations ENABLE ROW LEVEL SECURITY;

-- Apenas owner/admin podem ver
CREATE POLICY "Owners can view runtime violations"
ON public.storefront_runtime_violations
FOR SELECT
USING (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
);

-- Escrita apenas via service role (edge functions) - sem policy para INSERT público