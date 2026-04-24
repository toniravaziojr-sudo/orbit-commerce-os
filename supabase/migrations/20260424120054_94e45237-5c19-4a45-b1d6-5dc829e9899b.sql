
-- ============================================================
-- TRIGGER: disparar ai-signal-capture ao resolver conversa
-- ============================================================

-- Fila auxiliar (idempotente) para garantir rastreabilidade e reprocessamento
CREATE TABLE IF NOT EXISTS public.ai_signal_capture_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  CONSTRAINT ai_signal_capture_queue_conv_unique UNIQUE (conversation_id)
);

ALTER TABLE public.ai_signal_capture_queue ENABLE ROW LEVEL SECURITY;

-- Só service_role mexe nessa fila (é sistêmica)
DROP POLICY IF EXISTS "service role full access" ON public.ai_signal_capture_queue;
CREATE POLICY "service role full access"
  ON public.ai_signal_capture_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_signal_queue_pending
  ON public.ai_signal_capture_queue (status, enqueued_at)
  WHERE status = 'pending';

-- Função que dispara a captura via net.http_post e enfileira
CREATE OR REPLACE FUNCTION public.trigger_ai_signal_capture_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_auth text;
BEGIN
  -- Só dispara na transição para 'resolved' (evita loop e reprocessamento)
  IF NEW.status = 'resolved'::conversation_status
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- Enfileira (idempotente via UNIQUE em conversation_id)
    INSERT INTO public.ai_signal_capture_queue (tenant_id, conversation_id, status)
    VALUES (NEW.tenant_id, NEW.id, 'pending')
    ON CONFLICT (conversation_id) DO NOTHING;

    -- Dispara a edge function em background (não bloqueia)
    v_url := 'https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/ai-signal-capture';
    v_auth := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3NlemZqaGR2dm5jc3F5aHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcyMDksImV4cCI6MjA4MTE2MzIwOX0.xijqzFrwy221qrnnwU2PAH7Kk6Qm2AlfXhbk6uEVAVg';

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', v_auth
      ),
      body := jsonb_build_object(
        'tenant_id', NEW.tenant_id,
        'conversation_id', NEW.id,
        'trigger_source', 'conversation_resolved'
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia a resolução da conversa por falha de captura
  RAISE WARNING 'trigger_ai_signal_capture_on_resolve failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Garante que o trigger seja re-registrado limpo
DROP TRIGGER IF EXISTS conversations_signal_capture_on_resolve ON public.conversations;
CREATE TRIGGER conversations_signal_capture_on_resolve
  AFTER UPDATE OF status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ai_signal_capture_on_resolve();
