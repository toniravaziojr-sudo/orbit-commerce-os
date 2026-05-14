-- Lote 1.E — Webhook Focus NFe multi-tenant (status, validação e segurança)
ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS webhook_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS webhook_url_sanitized text,
  ADD COLUMN IF NOT EXISTS webhook_environment text,
  ADD COLUMN IF NOT EXISTS webhook_focus_hook_id text,
  ADD COLUMN IF NOT EXISTS webhook_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_last_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_last_error text,
  ADD COLUMN IF NOT EXISTS webhook_last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_tenant_token text,
  ADD COLUMN IF NOT EXISTS webhook_token_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS focus_company_status text NOT NULL DEFAULT 'unknown';

-- Validação dos enums (trigger ao invés de CHECK para permitir evolução)
ALTER TABLE public.fiscal_settings
  DROP CONSTRAINT IF EXISTS fiscal_settings_webhook_status_check;
ALTER TABLE public.fiscal_settings
  ADD CONSTRAINT fiscal_settings_webhook_status_check
  CHECK (webhook_status IN ('not_configured','pending','validated','error'));

ALTER TABLE public.fiscal_settings
  DROP CONSTRAINT IF EXISTS fiscal_settings_webhook_environment_check;
ALTER TABLE public.fiscal_settings
  ADD CONSTRAINT fiscal_settings_webhook_environment_check
  CHECK (webhook_environment IS NULL OR webhook_environment IN ('homologacao','producao'));

ALTER TABLE public.fiscal_settings
  DROP CONSTRAINT IF EXISTS fiscal_settings_focus_company_status_check;
ALTER TABLE public.fiscal_settings
  ADD CONSTRAINT fiscal_settings_focus_company_status_check
  CHECK (focus_company_status IN ('unknown','active','pending','error'));

-- Índice para lookup rápido do tenant via token de webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_settings_webhook_tenant_token
  ON public.fiscal_settings(webhook_tenant_token)
  WHERE webhook_tenant_token IS NOT NULL;

-- Índice para health check (status pendente/erro)
CREATE INDEX IF NOT EXISTS idx_fiscal_settings_webhook_status_attention
  ON public.fiscal_settings(tenant_id)
  WHERE webhook_status IN ('pending','error','not_configured');

COMMENT ON COLUMN public.fiscal_settings.webhook_tenant_token IS
  'Token único por tenant usado na URL registrada no Focus (?t=<token>). NUNCA retornado em payloads públicos. Rotacionável via fiscal-webhook-register.';
COMMENT ON COLUMN public.fiscal_settings.webhook_url_sanitized IS
  'URL canônica do webhook SEM segredos (apenas para exibição na UI).';
COMMENT ON COLUMN public.fiscal_settings.webhook_status IS
  'Estado: not_configured | pending | validated | error';