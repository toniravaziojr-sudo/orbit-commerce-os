
-- =============================================
-- DUAL-MOTOR v6.0: Chat tables + budget tracking
-- =============================================

-- 1. Ads Chat Conversations
CREATE TABLE public.ads_chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  scope TEXT NOT NULL DEFAULT 'global', -- 'global' or 'account'
  ad_account_id TEXT, -- NULL for global scope
  channel TEXT, -- 'meta', 'google', 'tiktok' or NULL for global
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ads Chat Messages
CREATE TABLE public.ads_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ads_chat_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role TEXT NOT NULL DEFAULT 'user', -- 'user', 'assistant', 'system'
  content TEXT,
  tool_calls JSONB, -- for AI tool calls
  tool_results JSONB, -- for tool execution results
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add last_budget_adjusted_at to account configs for tracking adjustment intervals
ALTER TABLE public.ads_autopilot_account_configs 
  ADD COLUMN IF NOT EXISTS last_budget_adjusted_at TIMESTAMPTZ;

-- 4. Add motor_type to sessions for tracking which motor triggered
ALTER TABLE public.ads_autopilot_sessions
  ADD COLUMN IF NOT EXISTS motor_type TEXT DEFAULT 'guardian'; -- 'guardian' or 'strategist'

-- 5. Indexes
CREATE INDEX idx_ads_chat_conversations_tenant ON public.ads_chat_conversations(tenant_id);
CREATE INDEX idx_ads_chat_conversations_scope ON public.ads_chat_conversations(tenant_id, scope, ad_account_id);
CREATE INDEX idx_ads_chat_messages_conversation ON public.ads_chat_messages(conversation_id);
CREATE INDEX idx_ads_chat_messages_tenant ON public.ads_chat_messages(tenant_id);

-- 6. RLS
ALTER TABLE public.ads_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant conversations"
  ON public.ads_chat_conversations FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create conversations"
  ON public.ads_chat_conversations FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant conversations"
  ON public.ads_chat_conversations FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant conversations"
  ON public.ads_chat_conversations FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can view own tenant messages"
  ON public.ads_chat_messages FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can create messages"
  ON public.ads_chat_messages FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- 7. Updated_at trigger
CREATE TRIGGER update_ads_chat_conversations_updated_at
  BEFORE UPDATE ON public.ads_chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.ads_chat_messages;
