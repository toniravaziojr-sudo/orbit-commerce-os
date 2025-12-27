
-- =====================================================
-- SEGURANÇA WHATSAPP: Separar segredos do acesso tenant
-- =====================================================

-- 1. Dropar policies antigas que expõem tokens
DROP POLICY IF EXISTS "Owners/admins can view whatsapp config" ON public.whatsapp_configs;
DROP POLICY IF EXISTS "Owners/admins can insert whatsapp config" ON public.whatsapp_configs;
DROP POLICY IF EXISTS "Owners/admins can update whatsapp config" ON public.whatsapp_configs;
DROP POLICY IF EXISTS "Owners/admins can delete whatsapp config" ON public.whatsapp_configs;

-- 2. Criar função helper para verificar se é platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'respeiteohomem@gmail.com'
  )
$$;

-- 3. Nova policy: SOMENTE platform admin pode fazer CRUD completo
CREATE POLICY "Platform admin full access to whatsapp_configs"
ON public.whatsapp_configs
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 4. View segura para tenant (sem tokens) - tenant lê status/QR apenas
CREATE OR REPLACE VIEW public.whatsapp_configs_tenant AS
SELECT 
  id,
  tenant_id,
  provider,
  instance_id,  -- ID público, não é segredo
  connection_status,
  phone_number,
  qr_code,
  qr_expires_at,
  last_connected_at,
  last_error,
  is_enabled,
  created_at,
  updated_at
  -- EXCLUI: instance_token, client_token
FROM public.whatsapp_configs;

-- 5. Dar permissão de SELECT na view para authenticated
GRANT SELECT ON public.whatsapp_configs_tenant TO authenticated;

-- 6. RLS na view via função (tenant só vê seu próprio config)
-- Views não suportam RLS diretamente, mas podemos usar security_invoker
-- Alternativa: criar função que retorna os dados filtrados

-- Criar função segura para tenant buscar config
CREATE OR REPLACE FUNCTION public.get_whatsapp_config_for_tenant(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  provider text,
  instance_id text,
  connection_status text,
  phone_number text,
  qr_code text,
  qr_expires_at timestamptz,
  last_connected_at timestamptz,
  last_error text,
  is_enabled boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wc.id,
    wc.tenant_id,
    wc.provider,
    wc.instance_id,
    wc.connection_status,
    wc.phone_number,
    wc.qr_code,
    wc.qr_expires_at,
    wc.last_connected_at,
    wc.last_error,
    wc.is_enabled,
    wc.created_at,
    wc.updated_at
  FROM public.whatsapp_configs wc
  WHERE wc.tenant_id = p_tenant_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND ur.role IN ('owner', 'admin')
    )
$$;
