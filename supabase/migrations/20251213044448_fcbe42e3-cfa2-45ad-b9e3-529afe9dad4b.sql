-- 1) Criar função RPC segura para criar tenant
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(p_name text, p_slug text)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants;
BEGIN
  -- Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verificar se slug já existe
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already exists';
  END IF;

  -- Criar tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (p_name, p_slug)
  RETURNING * INTO v_tenant;

  -- Criar role de owner para o usuário
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (auth.uid(), v_tenant.id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Atualizar current_tenant_id no profile
  UPDATE public.profiles
  SET current_tenant_id = v_tenant.id
  WHERE id = auth.uid();

  RETURN v_tenant;
END;
$$;

-- 2) Permissões para authenticated chamar a RPC
GRANT EXECUTE ON FUNCTION public.create_tenant_for_user(text, text) TO authenticated;

-- 3) Remover política de INSERT direto (não mais necessária)
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;

-- 4) Manter apenas SELECT e UPDATE policies
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;

CREATE POLICY "tenants_select" 
ON public.tenants 
FOR SELECT 
TO authenticated
USING (user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "tenants_update" 
ON public.tenants 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), id, 'owner'::app_role) OR has_role(auth.uid(), id, 'admin'::app_role));

NOTIFY pgrst, 'reload schema';