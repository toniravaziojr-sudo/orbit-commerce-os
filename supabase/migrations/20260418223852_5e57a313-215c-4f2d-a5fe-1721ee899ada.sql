-- Function: hydrate_whatsapp_token_from_active_grant
-- Purpose: One-time/maintenance helper to copy the decrypted access token from the active
--          Meta grant into whatsapp_configs.access_token for a tenant. Used to remediate
--          tenants whose WhatsApp config was created/recreated before v1.4.0 of meta-integrations-manage.
-- Security: SECURITY DEFINER — only callable by service role (RLS-protected via REVOKE/GRANT below).

CREATE OR REPLACE FUNCTION public.hydrate_whatsapp_token_from_active_grant(
  p_tenant_id uuid,
  p_encryption_key text
)
RETURNS TABLE(updated_config_id uuid, token_present boolean, grant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id uuid;
  v_token_expires_at timestamptz;
  v_access_token text;
  v_config_id uuid;
BEGIN
  -- Find active grant
  SELECT id, token_expires_at INTO v_grant_id, v_token_expires_at
  FROM tenant_meta_auth_grants
  WHERE tenant_id = p_tenant_id AND status = 'active'
  ORDER BY granted_at DESC
  LIMIT 1;

  IF v_grant_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, NULL::uuid;
    RETURN;
  END IF;

  -- Decrypt token via existing helper
  SELECT access_token INTO v_access_token
  FROM public.get_meta_grant_token(v_grant_id, p_encryption_key);

  IF v_access_token IS NULL OR v_access_token = '' THEN
    RETURN QUERY SELECT NULL::uuid, false, v_grant_id;
    RETURN;
  END IF;

  -- Update whatsapp_configs row for this tenant + meta provider
  UPDATE whatsapp_configs
  SET access_token = v_access_token,
      token_expires_at = v_token_expires_at,
      last_error = NULL,
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND provider = 'meta'
  RETURNING id INTO v_config_id;

  RETURN QUERY SELECT v_config_id, (v_config_id IS NOT NULL), v_grant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hydrate_whatsapp_token_from_active_grant(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hydrate_whatsapp_token_from_active_grant(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hydrate_whatsapp_token_from_active_grant(uuid, text) TO service_role;