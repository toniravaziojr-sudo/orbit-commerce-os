-- Habilitar extensão pgcrypto se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recriar a função usando pgcrypto.gen_random_bytes corretamente
CREATE OR REPLACE FUNCTION public.generate_billing_checkout_token(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token TEXT;
  v_hash TEXT;
BEGIN
  -- Gerar token aleatório usando pgcrypto
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token::bytea, 'sha256'), 'hex');
  
  -- Salvar hash e expiração (24 horas)
  UPDATE public.billing_checkout_sessions
  SET 
    token_hash = v_hash,
    token_expires_at = now() + interval '24 hours'
  WHERE id = p_session_id;
  
  RETURN v_token;
END;
$function$;