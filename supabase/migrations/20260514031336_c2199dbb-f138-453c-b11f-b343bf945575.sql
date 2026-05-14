
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS focus_token_homologacao text,
  ADD COLUMN IF NOT EXISTS focus_token_producao text;

REVOKE SELECT (focus_token_homologacao, focus_token_producao)
  ON public.fiscal_settings FROM authenticated;
REVOKE SELECT (focus_token_homologacao, focus_token_producao)
  ON public.fiscal_settings FROM anon;

CREATE OR REPLACE FUNCTION public.fiscal_set_focus_tenant_token(
  p_tenant_id uuid,
  p_ambiente text,
  p_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(auth.uid(), p_tenant_id, 'owner'::app_role)
       OR public.has_role(auth.uid(), p_tenant_id, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  IF p_ambiente NOT IN ('homologacao','producao') THEN
    RAISE EXCEPTION 'Invalid ambiente' USING ERRCODE = '22023';
  END IF;

  v_clean := NULLIF(btrim(coalesce(p_token,'')), '');

  IF p_ambiente = 'homologacao' THEN
    UPDATE public.fiscal_settings
       SET focus_token_homologacao = v_clean,
           updated_at = now()
     WHERE tenant_id = p_tenant_id;
  ELSE
    UPDATE public.fiscal_settings
       SET focus_token_producao = v_clean,
           updated_at = now()
     WHERE tenant_id = p_tenant_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiscal settings not found for tenant' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'ambiente', p_ambiente, 'configured', v_clean IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscal_focus_tenant_token_status(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_h boolean := false;
  v_p boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(auth.uid(), p_tenant_id, 'owner'::app_role)
       OR public.has_role(auth.uid(), p_tenant_id, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(length(btrim(coalesce(focus_token_homologacao,''))) > 0, false),
    coalesce(length(btrim(coalesce(focus_token_producao,''))) > 0, false)
    INTO v_h, v_p
  FROM public.fiscal_settings
  WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('homologacao', coalesce(v_h,false), 'producao', coalesce(v_p,false));
END;
$$;

REVOKE ALL ON FUNCTION public.fiscal_set_focus_tenant_token(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_set_focus_tenant_token(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fiscal_focus_tenant_token_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_focus_tenant_token_status(uuid) TO authenticated;
