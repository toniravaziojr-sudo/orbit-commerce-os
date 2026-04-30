CREATE TABLE IF NOT EXISTS public.conversation_sales_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  stage TEXT NOT NULL DEFAULT 'exploring'
    CHECK (stage IN (
      'social_only','exploring','needs_known','evaluating',
      'buying_intent','closing','post_sale'
    )),
  last_greeting_at TIMESTAMPTZ,
  presented_families TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  presented_product_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  customer_named_families TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  customer_declared_pain TEXT,
  asked_question_hashes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  commercial_signals JSONB NOT NULL DEFAULT '{}'::JSONB,
  upsell_offered_count INT NOT NULL DEFAULT 0,
  upsell_declined BOOLEAN NOT NULL DEFAULT FALSE,
  extras JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_sales_state_tenant
  ON public.conversation_sales_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_sales_state_stage
  ON public.conversation_sales_state(tenant_id, stage);

DROP TRIGGER IF EXISTS trg_conv_sales_state_updated_at ON public.conversation_sales_state;
CREATE TRIGGER trg_conv_sales_state_updated_at
BEFORE UPDATE ON public.conversation_sales_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conversation_sales_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.conversation_sales_state;
CREATE POLICY "service_role full access"
ON public.conversation_sales_state
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "tenant members can read" ON public.conversation_sales_state;
CREATE POLICY "tenant members can read"
ON public.conversation_sales_state
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "block anon" ON public.conversation_sales_state;
CREATE POLICY "block anon"
ON public.conversation_sales_state
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.conversation_sales_state IS
  'Reg #2.9 — Working memory persistente do pipeline de vendas WhatsApp (1:1 com conversa).';