-- Tabela para armazenar credenciais da plataforma (editáveis pelo admin)
-- Edge functions fazem fallback para env vars se credential_value for NULL
CREATE TABLE public.platform_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credential_key TEXT NOT NULL UNIQUE,
  credential_value TEXT, -- NULL significa usar env var como fallback
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Índice para busca rápida por chave
CREATE INDEX idx_platform_credentials_key ON public.platform_credentials(credential_key);

-- RLS: Apenas platform admin pode ver/editar
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin can view credentials"
  ON public.platform_credentials
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admin can insert credentials"
  ON public.platform_credentials
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admin can update credentials"
  ON public.platform_credentials
  FOR UPDATE
  USING (public.is_platform_admin());

CREATE POLICY "Platform admin can delete credentials"
  ON public.platform_credentials
  FOR DELETE
  USING (public.is_platform_admin());