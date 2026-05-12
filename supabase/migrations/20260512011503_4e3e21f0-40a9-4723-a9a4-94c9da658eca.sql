ALTER TABLE public.whatsapp_webhook_raw_audit
  ADD COLUMN IF NOT EXISTS hmac_status text NULL,
  ADD COLUMN IF NOT EXISTS hmac_sig_prefix text NULL;

COMMENT ON COLUMN public.whatsapp_webhook_raw_audit.hmac_status IS
  'F2.13.3 Onda 2.1 — Resultado observacional da validação HMAC SHA-256 do POST recebido (valid|invalid|missing|malformed|secret_missing). Log-mode: NUNCA usado para bloquear o webhook nesta fase. Linhas anteriores à Onda 2.1 ficam NULL e devem ser excluídas do cálculo da janela observacional.';

COMMENT ON COLUMN public.whatsapp_webhook_raw_audit.hmac_sig_prefix IS
  'F2.13.3 Onda 2.1 — Prefixo de até 8 caracteres hex da assinatura x-hub-signature-256 recebida, apenas para correlação forense. Jamais contém a assinatura completa nem o META_APP_SECRET.';