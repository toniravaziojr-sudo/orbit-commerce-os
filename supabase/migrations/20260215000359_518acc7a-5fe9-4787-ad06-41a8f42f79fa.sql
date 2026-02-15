
-- =============================================
-- Fase 5: Google Analytics GA4 — Cache de relatórios
-- =============================================

-- Tabela de relatórios GA4 (cache de métricas agregadas)
CREATE TABLE public.google_analytics_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'daily_overview',
  date DATE NOT NULL,
  dimensions JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ga_reports UNIQUE (tenant_id, property_id, report_type, date, dimensions)
);

-- Índices
CREATE INDEX idx_ga_reports_tenant_date ON public.google_analytics_reports(tenant_id, date DESC);
CREATE INDEX idx_ga_reports_property ON public.google_analytics_reports(property_id);

-- RLS
ALTER TABLE public.google_analytics_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view ga reports"
  ON public.google_analytics_reports FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert ga reports"
  ON public.google_analytics_reports FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update ga reports"
  ON public.google_analytics_reports FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete ga reports"
  ON public.google_analytics_reports FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));
