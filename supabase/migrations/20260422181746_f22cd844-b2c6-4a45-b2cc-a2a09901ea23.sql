-- F1 — Pipeline Básica IA: Estabilização do Núcleo

-- 1) Estado comercial em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sales_state TEXT NOT NULL DEFAULT 'greeting',
  ADD COLUMN IF NOT EXISTS sales_state_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_intent TEXT,
  ADD COLUMN IF NOT EXISTS discovery_questions_asked INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS images_sent_per_product JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_bot_response_hash TEXT;

CREATE OR REPLACE FUNCTION public.validate_conversation_sales_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sales_state NOT IN (
    'greeting','discovery','recommendation','consideration',
    'decision','cart','checkout','post_sale','handoff'
  ) THEN
    RAISE EXCEPTION 'Invalid sales_state: %', NEW.sales_state;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.sales_state IS DISTINCT FROM OLD.sales_state THEN
    NEW.sales_state_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_conversation_sales_state ON public.conversations;
CREATE TRIGGER trg_validate_conversation_sales_state
  BEFORE INSERT OR UPDATE OF sales_state ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_conversation_sales_state();

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_sales_state
  ON public.conversations(tenant_id, sales_state)
  WHERE status NOT IN ('resolved','spam');

-- 2) ai_support_turn_log
CREATE TABLE IF NOT EXISTS public.ai_support_turn_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  message_id UUID,
  turn_number INTEGER NOT NULL DEFAULT 1,
  sales_state_before TEXT,
  sales_state_after TEXT,
  last_user_message TEXT,
  last_user_message_at TIMESTAMPTZ,
  intent_classified TEXT,
  sentiment TEXT,
  urgency TEXT,
  context_blocks_included JSONB NOT NULL DEFAULT '[]'::jsonb,
  history_messages_count INTEGER NOT NULL DEFAULT 0,
  history_scope_validated BOOLEAN NOT NULL DEFAULT false,
  tools_available JSONB NOT NULL DEFAULT '[]'::jsonb,
  tools_called JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_used TEXT,
  temperature_sent NUMERIC,
  response_hash TEXT,
  response_length INTEGER,
  duration_ms INTEGER,
  anti_repetition_blocked BOOLEAN NOT NULL DEFAULT false,
  anti_greeting_blocked BOOLEAN NOT NULL DEFAULT false,
  image_send_blocked BOOLEAN NOT NULL DEFAULT false,
  image_block_reason TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_turn_log_conversation ON public.ai_support_turn_log(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_turn_log_tenant_time ON public.ai_support_turn_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_turn_log_state ON public.ai_support_turn_log(tenant_id, sales_state_after, created_at DESC);

ALTER TABLE public.ai_support_turn_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view turn logs"
  ON public.ai_support_turn_log
  FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_platform_admin()
  );