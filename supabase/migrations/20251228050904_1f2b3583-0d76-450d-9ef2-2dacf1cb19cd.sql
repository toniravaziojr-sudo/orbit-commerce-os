-- Adicionar colunas para email de atendimento separado (SAC) em email_provider_configs
ALTER TABLE public.email_provider_configs
  ADD COLUMN IF NOT EXISTS support_email_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_email_address text,
  ADD COLUMN IF NOT EXISTS support_imap_host text,
  ADD COLUMN IF NOT EXISTS support_imap_port integer DEFAULT 993,
  ADD COLUMN IF NOT EXISTS support_imap_user text,
  ADD COLUMN IF NOT EXISTS support_imap_password text,
  ADD COLUMN IF NOT EXISTS support_imap_tls boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS support_reply_from_name text,
  ADD COLUMN IF NOT EXISTS support_reply_from_email text,
  ADD COLUMN IF NOT EXISTS support_last_poll_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_connection_status text DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS support_last_error text;

-- Index para polling eficiente
CREATE INDEX IF NOT EXISTS idx_email_provider_configs_support_poll 
  ON public.email_provider_configs (support_email_enabled, support_last_poll_at) 
  WHERE support_email_enabled = true;