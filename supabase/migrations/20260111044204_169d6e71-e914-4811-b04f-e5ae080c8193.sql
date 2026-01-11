-- Atualizar função accept_invitation para SEMPRE setar current_tenant_id ao aceitar convite
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
  
  -- SEMPRE atualizar current_tenant_id do profile para o tenant do convite
  -- Isso garante que o usuário entre direto no tenant correto após aceitar
  UPDATE public.profiles
  SET current_tenant_id = v_invitation.tenant_id
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'tenant_id', v_invitation.tenant_id,
    'user_type', v_invitation.user_type
  );
END;
$$;