
-- =============================================================================
-- CORREÇÃO ESTRUTURAL: Permitir que owners vejam perfis de membros do tenant
-- =============================================================================

-- 1. Criar nova função helper para verificar se usuário é owner de qualquer tenant que o membro faça parte
CREATE OR REPLACE FUNCTION public.is_owner_of_member_tenant(p_owner_id UUID, p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles owner_role
    JOIN public.user_roles member_role ON owner_role.tenant_id = member_role.tenant_id
    WHERE owner_role.user_id = p_owner_id
      AND owner_role.role = 'owner'
      AND member_role.user_id = p_member_id
  )
$$;

-- 2. Dropar política antiga de select
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view team member profiles" ON public.profiles;

-- 3. Adicionar política para owners verem perfis de membros do tenant
CREATE POLICY "Owners can view team member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR public.is_owner_of_member_tenant(auth.uid(), id)
);

-- 4. Recriar política de update (apenas próprio perfil)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 5. Adicionar política para owners atualizarem nome de membros
DROP POLICY IF EXISTS "Owners can update team member names" ON public.profiles;
CREATE POLICY "Owners can update team member names"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_owner_of_member_tenant(auth.uid(), id))
WITH CHECK (public.is_owner_of_member_tenant(auth.uid(), id));
