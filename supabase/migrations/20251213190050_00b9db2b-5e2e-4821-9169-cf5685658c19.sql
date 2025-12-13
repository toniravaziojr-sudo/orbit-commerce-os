-- Permitir que usuários do tenant vejam store_settings (para preview no admin)
CREATE POLICY "Tenant users can view own store settings"
ON public.store_settings
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));