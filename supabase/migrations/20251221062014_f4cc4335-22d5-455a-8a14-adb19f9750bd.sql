-- Tabela de secrets para webhooks externos (autenticação por tenant/provider)
CREATE TABLE IF NOT EXISTS public.webhook_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  secret TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- Índices
CREATE INDEX idx_webhook_secrets_tenant_provider ON public.webhook_secrets(tenant_id, provider);

-- Trigger updated_at
CREATE TRIGGER update_webhook_secrets_updated_at
  BEFORE UPDATE ON public.webhook_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários do tenant
CREATE POLICY "webhook_secrets_select"
  ON public.webhook_secrets FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- INSERT: owner/admin
CREATE POLICY "webhook_secrets_insert"
  ON public.webhook_secrets FOR INSERT
  WITH CHECK (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND (
      public.has_role(auth.uid(), tenant_id, 'owner')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  );

-- UPDATE: owner/admin
CREATE POLICY "webhook_secrets_update"
  ON public.webhook_secrets FOR UPDATE
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND (
      public.has_role(auth.uid(), tenant_id, 'owner')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  )
  WITH CHECK (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND (
      public.has_role(auth.uid(), tenant_id, 'owner')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  );

-- DELETE: owner/admin
CREATE POLICY "webhook_secrets_delete"
  ON public.webhook_secrets FOR DELETE
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND (
      public.has_role(auth.uid(), tenant_id, 'owner')
      OR public.has_role(auth.uid(), tenant_id, 'admin')
    )
  );