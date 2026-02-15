
-- =============================================
-- Fase 6: Google Search Console — Cache de dados
-- =============================================

-- Tabela para armazenar dados de performance do Search Console
CREATE TABLE public.google_search_console_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'search_analytics',
  date DATE NOT NULL,
  query TEXT,
  page TEXT,
  country TEXT,
  device TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(6,4) NOT NULL DEFAULT 0,
  position NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_search_console_data UNIQUE(tenant_id, site_url, date, query, page, country, device)
);

-- Índices
CREATE INDEX idx_gsc_tenant_site ON public.google_search_console_data(tenant_id, site_url);
CREATE INDEX idx_gsc_date ON public.google_search_console_data(date DESC);

-- RLS
ALTER TABLE public.google_search_console_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view search console data"
  ON public.google_search_console_data FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role can manage search console data"
  ON public.google_search_console_data FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_google_search_console_data_updated_at
  BEFORE UPDATE ON public.google_search_console_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
