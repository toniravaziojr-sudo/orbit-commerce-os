-- Phase 7: Create update_meta_grant_token RPC for secure token re-encryption
-- Used by meta-token-refresh to update grant tokens after renewal

CREATE OR REPLACE FUNCTION public.update_meta_grant_token(
  p_grant_id UUID,
  p_new_token TEXT,
  p_encryption_key TEXT,
  p_new_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenant_meta_auth_grants
  SET
    encrypted_token = pgp_sym_encrypt(p_new_token, p_encryption_key)::bytea,
    token_expires_at = p_new_expires_at
  WHERE id = p_grant_id;
END;
$$;

-- Add revoked_at and revoke_reason columns for disconnect tracking
ALTER TABLE public.tenant_meta_auth_grants
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revoke_reason TEXT;