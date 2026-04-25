-- D9 evidence harness: ativa canal chat para tenant de teste e cria conversa técnica controlada
UPDATE public.channel_accounts
SET is_active = true
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND channel_type = 'chat';

INSERT INTO public.ai_channel_config (tenant_id, channel_type, is_enabled)
VALUES ('d1a4d0ed-8842-495e-b741-540a9a345b25', 'chat', true)
ON CONFLICT (tenant_id, channel_type) DO UPDATE SET is_enabled = true;