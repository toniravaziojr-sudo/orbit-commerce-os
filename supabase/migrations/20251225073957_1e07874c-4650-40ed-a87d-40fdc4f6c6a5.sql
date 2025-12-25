-- Tabela para configuração de provedor de email por tenant
CREATE TABLE public.email_provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL DEFAULT 'resend', -- 'resend', 'smtp', etc.
  from_name TEXT NOT NULL DEFAULT 'Minha Loja',
  from_email TEXT NOT NULL,
  reply_to TEXT,
  is_verified BOOLEAN DEFAULT false,
  last_test_at TIMESTAMP WITH TIME ZONE,
  last_test_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.email_provider_configs ENABLE ROW LEVEL SECURITY;

-- Policies: apenas owner/admin do tenant pode ver e editar
CREATE POLICY "Owners can manage email config"
ON public.email_provider_configs
FOR ALL
USING (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
);

-- Trigger para updated_at
CREATE TRIGGER update_email_provider_configs_updated_at
BEFORE UPDATE ON public.email_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();