
CREATE TABLE public.command_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  severity TEXT NOT NULL DEFAULT 'info',
  data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_command_insights_tenant_period ON public.command_insights(tenant_id, period_end DESC);
CREATE INDEX idx_command_insights_status ON public.command_insights(tenant_id, status);

ALTER TABLE public.command_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view insights"
  ON public.command_insights FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update insight status"
  ON public.command_insights FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role can insert insights"
  ON public.command_insights FOR INSERT
  TO service_role
  WITH CHECK (true);
