CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_raw_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  trace_id text,
  method text,
  remote_ip text,
  user_agent text,
  signature_header text,
  content_length int,
  body_sha256 text,
  body_preview text,
  headers_json jsonb,
  query_string text
);
CREATE INDEX IF NOT EXISTS idx_wa_raw_audit_received ON public.whatsapp_webhook_raw_audit (received_at DESC);
ALTER TABLE public.whatsapp_webhook_raw_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins can read raw audit"
  ON public.whatsapp_webhook_raw_audit FOR SELECT
  TO authenticated
  USING (is_platform_admin());