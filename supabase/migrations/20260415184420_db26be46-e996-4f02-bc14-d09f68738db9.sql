-- WMS Pratika configuration per tenant
CREATE TABLE public.wms_pratika_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  endpoint_url TEXT NOT NULL DEFAULT 'http://wmspratika.ddsinformatica.com.br/WsSoap/WsRecepcaoNfe.asmx',
  cnpj TEXT,
  auto_send_nfe BOOLEAN NOT NULL DEFAULT true,
  auto_send_label BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.wms_pratika_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view WMS config"
  ON public.wms_pratika_configs FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Tenant can insert WMS config"
  ON public.wms_pratika_configs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Tenant can update WMS config"
  ON public.wms_pratika_configs FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Service role can select WMS configs"
  ON public.wms_pratika_configs FOR SELECT
  TO service_role
  USING (true);

-- WMS Pratika send logs
CREATE TABLE public.wms_pratika_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  request_payload TEXT,
  response_payload TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wms_pratika_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view WMS logs"
  ON public.wms_pratika_logs FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Tenant can insert WMS logs"
  ON public.wms_pratika_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Service role can insert WMS logs"
  ON public.wms_pratika_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select WMS logs"
  ON public.wms_pratika_logs FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX idx_wms_pratika_logs_tenant_created ON public.wms_pratika_logs(tenant_id, created_at DESC);

CREATE TRIGGER update_wms_pratika_configs_updated_at
  BEFORE UPDATE ON public.wms_pratika_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();