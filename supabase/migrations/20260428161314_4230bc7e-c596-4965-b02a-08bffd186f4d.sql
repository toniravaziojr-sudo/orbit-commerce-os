-- ONDA 6 — RPC unificado de bootstrap
CREATE OR REPLACE FUNCTION public.get_user_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile jsonb;
  v_roles jsonb;
  v_tenants jsonb;
  v_tenant_ids uuid[];
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('profile', NULL, 'roles', '[]'::jsonb, 'tenants', '[]'::jsonb);
  END IF;

  SELECT to_jsonb(p.*) INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ur.id,
    'user_id', ur.user_id,
    'tenant_id', ur.tenant_id,
    'role', ur.role,
    'user_type', ur.user_type,
    'permissions', COALESCE(ur.permissions, '{}'::jsonb)
  )), '[]'::jsonb) INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id;

  SELECT ARRAY(
    SELECT DISTINCT ur.tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.tenant_id IS NOT NULL
  ) INTO v_tenant_ids;

  IF array_length(v_tenant_ids, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb) INTO v_tenants
    FROM public.tenants t
    WHERE t.id = ANY(v_tenant_ids);
  ELSE
    v_tenants := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('profile', v_profile, 'roles', v_roles, 'tenants', v_tenants);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_bootstrap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_bootstrap() TO authenticated;

COMMENT ON FUNCTION public.get_user_bootstrap() IS
'ONDA 6 — Bootstrap unificado (profile + roles + tenants em 1 chamada).';
