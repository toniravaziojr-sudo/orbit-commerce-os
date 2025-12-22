-- =============================================
-- HEALTH MONITOR: Tabelas para checagens automáticas de produção
-- =============================================

-- Targets: URLs que o health monitor deve testar
CREATE TABLE public.system_health_check_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  storefront_base_url TEXT NOT NULL,
  shops_base_url TEXT,
  test_coupon_code TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log de cada execução do health check
CREATE TABLE public.system_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id UUID REFERENCES public.system_health_check_targets(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  environment TEXT NOT NULL DEFAULT 'production',
  check_suite TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'partial')),
  summary TEXT,
  details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_health_checks_tenant_ran ON public.system_health_checks(tenant_id, ran_at DESC);
CREATE INDEX idx_health_checks_status ON public.system_health_checks(status, ran_at DESC);
CREATE INDEX idx_health_check_targets_tenant ON public.system_health_check_targets(tenant_id);
CREATE INDEX idx_health_check_targets_enabled ON public.system_health_check_targets(is_enabled) WHERE is_enabled = true;

-- RLS
ALTER TABLE public.system_health_check_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Policies: apenas owner/admin do tenant podem ler
CREATE POLICY "Owners can view health check targets"
ON public.system_health_check_targets
FOR SELECT
USING (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Owners can manage health check targets"
ON public.system_health_check_targets
FOR ALL
USING (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Owners can view health checks"
ON public.system_health_checks
FOR SELECT
USING (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
);

-- Trigger para updated_at
CREATE TRIGGER update_health_check_targets_updated_at
BEFORE UPDATE ON public.system_health_check_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();