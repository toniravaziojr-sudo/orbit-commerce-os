-- Create separate tables for ChatGPT conversations (independent from Command Assistant)

-- ChatGPT Conversations table
CREATE TABLE public.chatgpt_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Nova conversa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ChatGPT Messages table
CREATE TABLE public.chatgpt_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chatgpt_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatgpt_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chatgpt_conversations
CREATE POLICY "Users can view their own ChatGPT conversations"
ON public.chatgpt_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ChatGPT conversations"
ON public.chatgpt_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ChatGPT conversations"
ON public.chatgpt_conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ChatGPT conversations"
ON public.chatgpt_conversations FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for chatgpt_messages
CREATE POLICY "Users can view their own ChatGPT messages"
ON public.chatgpt_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ChatGPT messages"
ON public.chatgpt_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ChatGPT messages"
ON public.chatgpt_messages FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_chatgpt_conversations_tenant_user ON public.chatgpt_conversations(tenant_id, user_id);
CREATE INDEX idx_chatgpt_conversations_updated ON public.chatgpt_conversations(updated_at DESC);
CREATE INDEX idx_chatgpt_messages_conversation ON public.chatgpt_messages(conversation_id);
CREATE INDEX idx_chatgpt_messages_created ON public.chatgpt_messages(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_chatgpt_conversations_updated_at
BEFORE UPDATE ON public.chatgpt_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();