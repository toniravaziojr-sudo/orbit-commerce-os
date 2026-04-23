-- Auditoria mínima do inbound Meta (Pacote 3)
-- Campos opcionais e tolerantes a falha. Nenhuma constraint nova.
ALTER TABLE public.whatsapp_inbound_messages
  ADD COLUMN IF NOT EXISTS processing_status text,
  ADD COLUMN IF NOT EXISTS processing_error text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_received_recent
  ON public.whatsapp_inbound_messages (tenant_id, "timestamp" DESC);