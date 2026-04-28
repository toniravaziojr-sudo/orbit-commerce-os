-- Camada 6: índice para dedupe rápido de redeliveries da Meta
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_external_msg_id
  ON public.whatsapp_inbound_messages (tenant_id, external_message_id, processed_at)
  WHERE external_message_id IS NOT NULL;