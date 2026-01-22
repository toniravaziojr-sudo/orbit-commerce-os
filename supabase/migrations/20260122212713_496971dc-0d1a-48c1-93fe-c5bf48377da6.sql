-- Adiciona política RLS para owners/admins do tenant poderem ler suas configs
CREATE POLICY "Tenant owners can view their whatsapp_configs"
ON public.whatsapp_configs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = whatsapp_configs.tenant_id
      AND ur.role IN ('owner', 'admin')
  )
);

-- Adiciona política RLS para owners/admins do tenant poderem inserir configs
CREATE POLICY "Tenant owners can insert their whatsapp_configs"
ON public.whatsapp_configs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = whatsapp_configs.tenant_id
      AND ur.role IN ('owner', 'admin')
  )
);

-- Adiciona política RLS para owners/admins do tenant poderem atualizar configs
CREATE POLICY "Tenant owners can update their whatsapp_configs"
ON public.whatsapp_configs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = whatsapp_configs.tenant_id
      AND ur.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = whatsapp_configs.tenant_id
      AND ur.role IN ('owner', 'admin')
  )
);

-- Adiciona política RLS para owners/admins do tenant poderem deletar configs
CREATE POLICY "Tenant owners can delete their whatsapp_configs"
ON public.whatsapp_configs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = whatsapp_configs.tenant_id
      AND ur.role IN ('owner', 'admin')
  )
);