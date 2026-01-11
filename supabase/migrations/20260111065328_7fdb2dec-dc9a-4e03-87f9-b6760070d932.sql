-- =============================================
-- COMMAND ASSISTANT TABLES (tenant-scoped)
-- =============================================

-- Conversations table
CREATE TABLE public.command_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE public.command_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.command_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachments table
CREATE TABLE public.command_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.command_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_command_conversations_tenant ON public.command_conversations(tenant_id);
CREATE INDEX idx_command_conversations_user ON public.command_conversations(user_id);
CREATE INDEX idx_command_messages_conversation ON public.command_messages(conversation_id);
CREATE INDEX idx_command_messages_tenant ON public.command_messages(tenant_id);
CREATE INDEX idx_command_attachments_message ON public.command_message_attachments(message_id);

-- Enable RLS
ALTER TABLE public.command_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for command_conversations
CREATE POLICY "Users can view their own conversations"
ON public.command_conversations FOR SELECT
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = command_conversations.tenant_id
  )
);

CREATE POLICY "Users can create their own conversations"
ON public.command_conversations FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = command_conversations.tenant_id
  )
);

CREATE POLICY "Users can update their own conversations"
ON public.command_conversations FOR UPDATE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = command_conversations.tenant_id
  )
);

CREATE POLICY "Users can delete their own conversations"
ON public.command_conversations FOR DELETE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = command_conversations.tenant_id
  )
);

-- RLS Policies for command_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.command_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.command_conversations cc
    WHERE cc.id = command_messages.conversation_id
    AND cc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in their conversations"
ON public.command_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.command_conversations cc
    WHERE cc.id = command_messages.conversation_id
    AND cc.user_id = auth.uid()
  )
);

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments in their messages"
ON public.command_message_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.command_messages cm
    JOIN public.command_conversations cc ON cc.id = cm.conversation_id
    WHERE cm.id = command_message_attachments.message_id
    AND cc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create attachments in their messages"
ON public.command_message_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.command_messages cm
    JOIN public.command_conversations cc ON cc.id = cm.conversation_id
    WHERE cm.id = command_message_attachments.message_id
    AND cc.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_command_conversations_updated_at
BEFORE UPDATE ON public.command_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();