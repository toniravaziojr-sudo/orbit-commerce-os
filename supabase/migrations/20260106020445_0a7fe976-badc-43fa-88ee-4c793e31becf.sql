-- Create whatsapp_configs entry for Comando Central tenant (idempotent)
INSERT INTO whatsapp_configs (tenant_id, is_enabled, connection_status)
VALUES ('cc000000-0000-0000-0000-000000000001', true, 'disconnected')
ON CONFLICT (tenant_id) DO NOTHING;