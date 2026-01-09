-- Tabela billing_checkout_sessions para vincular pagamento à criação de conta
CREATE TABLE public.billing_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_payment', 'paid', 'completed', 'failed', 'expired')),
  email TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  store_name TEXT NOT NULL,
  phone TEXT,
  slug TEXT,
  utm JSONB DEFAULT '{}',
  mp_external_reference TEXT UNIQUE,
  mp_preapproval_id TEXT,
  mp_payment_id TEXT,
  mp_init_point TEXT,
  token_hash TEXT,
  token_expires_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_billing_checkout_sessions_email ON public.billing_checkout_sessions(LOWER(email));
CREATE INDEX idx_billing_checkout_sessions_status ON public.billing_checkout_sessions(status);
CREATE INDEX idx_billing_checkout_sessions_mp_ref ON public.billing_checkout_sessions(mp_external_reference);
CREATE INDEX idx_billing_checkout_sessions_token ON public.billing_checkout_sessions(token_hash) WHERE token_hash IS NOT NULL;

-- Trigger para updated_at
CREATE TRIGGER update_billing_checkout_sessions_updated_at
  BEFORE UPDATE ON public.billing_checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: acesso apenas via service role (edge functions)
ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Policy para platform admins visualizarem (debug/suporte)
CREATE POLICY "Platform admins can view billing_checkout_sessions"
  ON public.billing_checkout_sessions
  FOR SELECT
  USING (public.is_platform_admin());

-- Função para gerar token seguro de conclusão de cadastro
CREATE OR REPLACE FUNCTION public.generate_billing_checkout_token(p_session_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
BEGIN
  -- Gerar token aleatório
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_token::bytea), 'hex');
  
  -- Salvar hash e expiração (24 horas)
  UPDATE public.billing_checkout_sessions
  SET 
    token_hash = v_hash,
    token_expires_at = now() + interval '24 hours'
  WHERE id = p_session_id;
  
  RETURN v_token;
END;
$$;

-- Função para validar token e retornar session_id
CREATE OR REPLACE FUNCTION public.validate_billing_checkout_token(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash TEXT;
  v_session_id UUID;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');
  
  SELECT id INTO v_session_id
  FROM public.billing_checkout_sessions
  WHERE token_hash = v_hash
    AND token_expires_at > now()
    AND status = 'paid';
  
  RETURN v_session_id;
END;
$$;