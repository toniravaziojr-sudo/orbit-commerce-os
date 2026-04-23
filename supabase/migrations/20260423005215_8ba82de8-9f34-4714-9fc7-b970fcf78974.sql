-- Pacote A: Fila de debounce de mensagens fragmentadas do WhatsApp
-- Cada inbound entra aqui; um worker (ou o próprio webhook após aguardar a janela)
-- agrupa as mensagens do mesmo (tenant, phone) dentro de uma janela curta.
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_debounce (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  external_message_id text,
  message_content text,
  received_at timestamptz NOT NULL DEFAULT now(),
  flush_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | flushed | merged | expired
  flushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_debounce_pending
  ON public.whatsapp_inbound_debounce (tenant_id, customer_phone, status, flush_at);
CREATE INDEX IF NOT EXISTS idx_inbound_debounce_conv
  ON public.whatsapp_inbound_debounce (conversation_id, status);

ALTER TABLE public.whatsapp_inbound_debounce ENABLE ROW LEVEL SECURITY;

-- Apenas service_role escreve aqui (webhook). Sem políticas para usuários finais.
DROP POLICY IF EXISTS "service role manages inbound debounce" ON public.whatsapp_inbound_debounce;
CREATE POLICY "service role manages inbound debounce"
  ON public.whatsapp_inbound_debounce
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
