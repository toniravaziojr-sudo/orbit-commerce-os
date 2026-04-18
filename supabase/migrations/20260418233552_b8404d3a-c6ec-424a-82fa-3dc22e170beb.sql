-- Adicionar colunas de recovery automático
ALTER TABLE public.whatsapp_configs
  ADD COLUMN IF NOT EXISTS register_pin text,
  ADD COLUMN IF NOT EXISTS webhook_subscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_diagnosed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_payload jsonb;

COMMENT ON COLUMN public.whatsapp_configs.register_pin IS 'PIN de 6 dígitos usado no /register da Meta. Persistido para recovery automático após desconexões. Acesso restrito.';
COMMENT ON COLUMN public.whatsapp_configs.webhook_subscribed_at IS 'Data da última confirmação de assinatura do webhook na Meta (subscribed_apps).';
COMMENT ON COLUMN public.whatsapp_configs.last_diagnosed_at IS 'Última execução do diagnóstico automático (meta-whatsapp-diagnose).';
COMMENT ON COLUMN public.whatsapp_configs.last_health_payload IS 'Snapshot bruto do health_status retornado pela Meta na última verificação.';

-- Índice para o cron de monitoramento diário
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_monitor
  ON public.whatsapp_configs (provider, connection_status, last_diagnosed_at)
  WHERE provider = 'meta';