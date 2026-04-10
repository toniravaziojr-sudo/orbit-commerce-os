-- Tabela de controle de uso de armazenamento por tenant
CREATE TABLE public.tenant_storage_usage (
  tenant_id UUID NOT NULL PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  limit_bytes BIGINT NOT NULL DEFAULT 5368709120, -- 5GB default (plano básico)
  last_recalculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_storage_usage ENABLE ROW LEVEL SECURITY;

-- Members can view their tenant's storage usage
CREATE POLICY "Tenant members can view storage usage"
  ON public.tenant_storage_usage
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

-- Trigger for updated_at
CREATE TRIGGER update_tenant_storage_usage_updated_at
  BEFORE UPDATE ON public.tenant_storage_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comment
COMMENT ON TABLE public.tenant_storage_usage IS 'Controle de uso de armazenamento (Meu Drive) por tenant. Limites baseados no plano: Básico=5GB, Médio=10GB, Completo=30GB.';