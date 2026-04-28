-- Função auxiliar para checar se o usuário é platform super_admin
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid()
      AND is_active = true
      AND role = 'super_admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated, service_role;

-- Tabela de auditoria de tentativas de login
CREATE TABLE public.auth_login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  user_id UUID,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email ON public.auth_login_attempts (lower(email), attempted_at DESC);
CREATE INDEX idx_login_attempts_ip ON public.auth_login_attempts (ip_address, attempted_at DESC);
CREATE INDEX idx_login_attempts_at ON public.auth_login_attempts (attempted_at DESC);
CREATE INDEX idx_login_attempts_user ON public.auth_login_attempts (user_id, attempted_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform super_admins can view all login attempts"
ON public.auth_login_attempts
FOR SELECT
TO authenticated
USING (public.is_platform_super_admin());

COMMENT ON TABLE public.auth_login_attempts IS 'Onda 5 F1: Audit log of login attempts. Insert via service_role only (edge function log-login-attempt). Read restricted to platform super_admin.';