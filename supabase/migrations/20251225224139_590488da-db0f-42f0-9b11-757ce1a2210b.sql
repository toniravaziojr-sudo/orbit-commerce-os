-- Tabela para configuração global do email do sistema (plataforma)
CREATE TABLE public.system_email_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_name TEXT NOT NULL DEFAULT 'Comando Central',
  from_email TEXT NOT NULL DEFAULT 'contato@comandocentral.com.br',
  reply_to TEXT,
  sending_domain TEXT DEFAULT 'comandocentral.com.br',
  provider_type TEXT NOT NULL DEFAULT 'resend',
  resend_domain_id TEXT,
  verification_status TEXT DEFAULT 'not_started' CHECK (verification_status IN ('not_started', 'pending', 'verified', 'failed')),
  dns_records JSONB DEFAULT '[]'::jsonb,
  verified_at TIMESTAMPTZ,
  last_verify_check_at TIMESTAMPTZ,
  last_verify_error TEXT,
  last_test_at TIMESTAMPTZ,
  last_test_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_email_config_updated_at
  BEFORE UPDATE ON public.system_email_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.system_email_config ENABLE ROW LEVEL SECURITY;

-- Apenas operadores da plataforma podem ver/editar (para segurança, usamos service role nas edge functions)
-- Não criamos policies públicas - acesso apenas via service role

-- Inserir config padrão
INSERT INTO public.system_email_config (from_name, from_email, sending_domain)
VALUES ('Comando Central', 'contato@comandocentral.com.br', 'comandocentral.com.br');

-- Tabela para logs de emails do sistema
CREATE TABLE public.system_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'test', 'auth', 'invite', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_email_logs ENABLE ROW LEVEL SECURITY;

-- Index para consultas
CREATE INDEX idx_system_email_logs_created_at ON public.system_email_logs(created_at DESC);
CREATE INDEX idx_system_email_logs_status ON public.system_email_logs(status);