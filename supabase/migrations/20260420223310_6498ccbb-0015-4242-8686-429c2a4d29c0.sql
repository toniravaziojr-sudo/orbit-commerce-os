-- Backfill manual: abrir janela de observação para o tenant respeiteohomem
-- A linha existia antes do trigger de migração ser criado, então nunca recebeu marcação.
-- Sem isso, o card mostra "saudável" indevidamente enquanto a recepção real ainda não foi comprovada.
UPDATE public.whatsapp_configs
SET migration_observation_until = now() + interval '24 hours',
    last_inbound_at = NULL
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND provider = 'meta'
  AND last_inbound_at IS NULL
  AND migration_observation_until IS NULL;