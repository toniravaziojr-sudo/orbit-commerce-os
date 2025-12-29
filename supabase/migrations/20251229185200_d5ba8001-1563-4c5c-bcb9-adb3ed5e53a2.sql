-- Tabela para jobs de importação
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  modules JSONB NOT NULL DEFAULT '[]',
  progress JSONB NOT NULL DEFAULT '{}',
  source_url TEXT,
  source_data JSONB,
  stats JSONB DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela para itens importados (para tracking e rollback)
CREATE TABLE public.import_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  external_id TEXT,
  internal_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  data_raw JSONB,
  data_normalized JSONB,
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_import_jobs_tenant ON public.import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX idx_import_items_job ON public.import_items(job_id);
CREATE INDEX idx_import_items_module ON public.import_items(module);
CREATE INDEX idx_import_items_external ON public.import_items(tenant_id, module, external_id);

-- RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_items ENABLE ROW LEVEL SECURITY;

-- Policies para import_jobs usando has_role
CREATE POLICY "Tenant members can view import jobs"
  ON public.import_jobs FOR SELECT
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role) OR has_role(auth.uid(), tenant_id, 'operator'::app_role));

CREATE POLICY "Admins can create import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Admins can update import jobs"
  ON public.import_jobs FOR UPDATE
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

CREATE POLICY "Admins can delete import jobs"
  ON public.import_jobs FOR DELETE
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

-- Policies para import_items
CREATE POLICY "Tenant members can view import items"
  ON public.import_items FOR SELECT
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role) OR has_role(auth.uid(), tenant_id, 'operator'::app_role));

CREATE POLICY "Admins can manage import items"
  ON public.import_items FOR ALL
  USING (has_role(auth.uid(), tenant_id, 'owner'::app_role) OR has_role(auth.uid(), tenant_id, 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime para acompanhar progresso
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;