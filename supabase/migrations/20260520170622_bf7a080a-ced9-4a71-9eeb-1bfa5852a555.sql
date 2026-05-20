ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_to text,
  ADD COLUMN IF NOT EXISTS email_send_status text,
  ADD COLUMN IF NOT EXISTS email_send_error text,
  ADD COLUMN IF NOT EXISTS email_provider_message_id text;

COMMENT ON COLUMN public.fiscal_invoices.email_sent_at IS 'Timestamp do último envio do e-mail da NF-e ao cliente (sucesso ou falha).';
COMMENT ON COLUMN public.fiscal_invoices.email_sent_to IS 'Endereço de e-mail do destinatário no último envio.';
COMMENT ON COLUMN public.fiscal_invoices.email_send_status IS 'Status do último envio: sent | failed.';
COMMENT ON COLUMN public.fiscal_invoices.email_send_error IS 'Mensagem de erro do último envio, quando status=failed.';
COMMENT ON COLUMN public.fiscal_invoices.email_provider_message_id IS 'Message-ID retornado pelo provedor de e-mail (SendGrid).';