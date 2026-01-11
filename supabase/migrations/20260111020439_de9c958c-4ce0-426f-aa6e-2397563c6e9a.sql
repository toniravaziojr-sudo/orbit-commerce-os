-- ===============================
-- RBAC Tenant Users - Tabela de Convites e Permissões
-- ===============================

-- 1. Criar tipo ENUM para user_type do tenant
CREATE TYPE public.tenant_user_type AS ENUM (
  'owner',
  'manager',
  'editor',
  'attendant',
  'assistant',
  'viewer'
);

-- 2. Adicionar colunas user_type e permissions na tabela user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS user_type public.tenant_user_type DEFAULT 'viewer',
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Atualizar user_type para 'owner' onde role = 'owner'
UPDATE public.user_roles 
SET user_type = 'owner' 
WHERE role = 'owner' AND user_type IS DISTINCT FROM 'owner';

-- 4. Criar tabela de convites
CREATE TABLE IF NOT EXISTS public.tenant_user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_type public.tenant_user_type NOT NULL DEFAULT 'viewer',
  permissions JSONB DEFAULT '{}',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscas por token e email
CREATE INDEX IF NOT EXISTS idx_tenant_user_invitations_token ON public.tenant_user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_user_invitations_email ON public.tenant_user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_user_invitations_tenant ON public.tenant_user_invitations(tenant_id);

-- 5. Habilitar RLS
ALTER TABLE public.tenant_user_invitations ENABLE ROW LEVEL SECURITY;

-- 6. Função para verificar se usuário é owner do tenant (com cache)
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'owner'
  )
$$;

-- 7. RLS Policies para tenant_user_invitations
-- Somente owner do tenant pode ver convites
CREATE POLICY "Owner can select tenant invitations"
ON public.tenant_user_invitations
FOR SELECT
TO authenticated
USING (public.is_tenant_owner(auth.uid(), tenant_id));

-- Somente owner pode criar convites
CREATE POLICY "Owner can insert tenant invitations"
ON public.tenant_user_invitations
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));

-- Somente owner pode atualizar convites (revogar, etc)
CREATE POLICY "Owner can update tenant invitations"
ON public.tenant_user_invitations
FOR UPDATE
TO authenticated
USING (public.is_tenant_owner(auth.uid(), tenant_id));

-- Somente owner pode deletar convites
CREATE POLICY "Owner can delete tenant invitations"
ON public.tenant_user_invitations
FOR DELETE
TO authenticated
USING (public.is_tenant_owner(auth.uid(), tenant_id));

-- 8. Policy para user_roles - owner pode gerenciar membros do tenant
-- Primeiro, dropar policies existentes que podem conflitar
DROP POLICY IF EXISTS "Owner can manage tenant user_roles" ON public.user_roles;

-- Owner pode ver todos os user_roles do seu tenant
CREATE POLICY "Owner can manage tenant user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_tenant_owner(auth.uid(), tenant_id)
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_tenant_owner(auth.uid(), tenant_id)
);

-- 9. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_user_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_tenant_user_invitations_updated_at ON public.tenant_user_invitations;
CREATE TRIGGER trg_tenant_user_invitations_updated_at
  BEFORE UPDATE ON public.tenant_user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_user_invitations_updated_at();

-- 10. Função para validar token de convite (usada pela edge function)
CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
RETURNS TABLE(
  invitation_id UUID,
  tenant_id UUID,
  email TEXT,
  user_type public.tenant_user_type,
  permissions JSONB,
  tenant_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.tenant_id,
    i.email,
    i.user_type,
    i.permissions,
    t.name
  FROM public.tenant_user_invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now();
END;
$$;

-- 11. Função para aceitar convite (usada pela edge function)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
  v_existing_role UUID;
BEGIN
  -- Buscar email do usuário autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;
  
  -- Buscar e validar convite
  SELECT * INTO v_invitation
  FROM public.tenant_user_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Validar que o email do convite é o mesmo do usuário (case-insensitive)
  IF LOWER(v_invitation.email) != LOWER(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este convite foi enviado para outro email');
  END IF;
  
  -- Verificar se já existe um role para este usuário/tenant
  SELECT id INTO v_existing_role
  FROM public.user_roles
  WHERE user_id = p_user_id AND tenant_id = v_invitation.tenant_id;
  
  IF v_existing_role IS NOT NULL THEN
    -- Atualizar role existente
    UPDATE public.user_roles
    SET 
      user_type = v_invitation.user_type,
      permissions = v_invitation.permissions,
      updated_at = now()
    WHERE id = v_existing_role;
  ELSE
    -- Criar novo role
    INSERT INTO public.user_roles (user_id, tenant_id, role, user_type, permissions, invited_by, invited_at)
    VALUES (
      p_user_id, 
      v_invitation.tenant_id, 
      'viewer', -- role padrão, user_type controla permissões
      v_invitation.user_type,
      v_invitation.permissions,
      v_invitation.invited_by,
      now()
    );
  END IF;
  
  -- Marcar convite como aceito
  UPDATE public.tenant_user_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  -- Atualizar current_tenant_id do profile se não tiver
  UPDATE public.profiles
  SET current_tenant_id = COALESCE(current_tenant_id, v_invitation.tenant_id)
  WHERE id = p_user_id AND current_tenant_id IS NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'tenant_id', v_invitation.tenant_id,
    'user_type', v_invitation.user_type
  );
END;
$$;