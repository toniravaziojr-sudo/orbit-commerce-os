
ALTER TABLE public.whatsapp_configs
  ADD COLUMN IF NOT EXISTS last_inbound_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_validation_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_window_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS v2_ui_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel_state text;

COMMENT ON COLUMN public.whatsapp_configs.last_inbound_validated_at IS
  'Timestamp da última mensagem real comprovadamente recebida e roteada para este tenant. Diferente de last_inbound_at: este só é atualizado quando há POST real no webhook routeado para o tenant correto. Fonte de verdade da Camada 3 (recepção real).';

COMMENT ON COLUMN public.whatsapp_configs.last_validation_attempt_at IS
  'Última vez que o tenant clicou em "Validar agora". Usado para distinguir silêncio natural de tentativa explícita expirada.';

COMMENT ON COLUMN public.whatsapp_configs.validation_window_opened_at IS
  'Início da janela de 10 minutos aberta pelo tenant para enviar mensagem real. Webhook compara com received_at; se POST cair dentro da janela, promove last_inbound_validated_at.';

COMMENT ON COLUMN public.whatsapp_configs.v2_ui_active_at IS
  'Marco do rollout informativo. Durante 7 dias após este timestamp, a UI v2 (card 3 sinais + amarelos) fica em modo informativo silencioso. Após esse período, ativa visualmente.';

COMMENT ON COLUMN public.whatsapp_configs.channel_state IS
  'Máquina de estados oficial do canal: disconnected | technically_connected | real_reception_pending | operational_validated | no_recent_evidence | degraded_after_validation. Calculado pelo detector e pelo health-summary; persistido para auditoria histórica.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_channel_state
  ON public.whatsapp_configs(channel_state)
  WHERE channel_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_validation_window
  ON public.whatsapp_configs(validation_window_opened_at)
  WHERE validation_window_opened_at IS NOT NULL;

INSERT INTO public.platform_credentials (credential_key, credential_value, is_active, description)
VALUES (
  'whatsapp_meta_partner_business_id',
  '',
  false,
  'Business ID oficial da plataforma na Meta (ex.: 1234567890). Usado no wizard cross-business para o tenant copiar e adicionar como parceiro na WABA dele. Admin de plataforma deve preencher em Configurações da Plataforma antes do wizard ficar utilizável. Quando vazio ou is_active=false, o wizard mostra placeholder amigável e instrui contato com suporte.'
)
ON CONFLICT (credential_key) DO NOTHING;
