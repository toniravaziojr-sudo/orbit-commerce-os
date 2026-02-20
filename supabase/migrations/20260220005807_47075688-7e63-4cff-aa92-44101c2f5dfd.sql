
-- =============================================
-- Sistema de Memória para IAs (v1.0.0)
-- Escopo Híbrido: tenant + user
-- =============================================

-- 1. Memórias de longo prazo (fatos, preferências, decisões)
CREATE TABLE public.ai_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID DEFAULT NULL, -- NULL = memória do tenant (negócio), preenchido = memória pessoal do usuário
  ai_agent TEXT NOT NULL, -- 'command_assistant', 'chatgpt', 'ads_chat', 'ads_autopilot', 'support'
  category TEXT NOT NULL DEFAULT 'general', -- 'business_fact', 'preference', 'decision', 'persona', 'product_insight', 'general'
  content TEXT NOT NULL, -- O fato/memória em si
  metadata JSONB DEFAULT '{}',
  importance INTEGER NOT NULL DEFAULT 5, -- 1-10, memórias mais importantes persistem mais
  source_conversation_id UUID DEFAULT NULL, -- Conversa de onde a memória foi extraída
  expires_at TIMESTAMPTZ DEFAULT NULL, -- NULL = nunca expira
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_ai_memories_tenant_agent ON public.ai_memories(tenant_id, ai_agent);
CREATE INDEX idx_ai_memories_tenant_user ON public.ai_memories(tenant_id, user_id);
CREATE INDEX idx_ai_memories_importance ON public.ai_memories(importance DESC);
CREATE INDEX idx_ai_memories_category ON public.ai_memories(category);

-- RLS
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view memories of their tenant"
  ON public.ai_memories FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert memories for their tenant"
  ON public.ai_memories FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update memories of their tenant"
  ON public.ai_memories FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete memories of their tenant"
  ON public.ai_memories FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- 2. Resumos de conversas anteriores
CREATE TABLE public.ai_conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Sempre por usuário
  ai_agent TEXT NOT NULL, -- 'command_assistant', 'chatgpt', 'ads_chat', 'ads_autopilot', 'support'
  conversation_id UUID NOT NULL, -- ID da conversa original (referência genérica)
  summary TEXT NOT NULL, -- Resumo conciso da conversa
  key_topics TEXT[] DEFAULT '{}', -- Tópicos principais abordados
  key_decisions JSONB DEFAULT '[]', -- Decisões tomadas na conversa
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ai_conv_summaries_tenant_agent ON public.ai_conversation_summaries(tenant_id, ai_agent);
CREATE INDEX idx_ai_conv_summaries_user ON public.ai_conversation_summaries(user_id, ai_agent);
CREATE INDEX idx_ai_conv_summaries_created ON public.ai_conversation_summaries(created_at DESC);

-- RLS
ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversation summaries"
  ON public.ai_conversation_summaries FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Edge functions can insert summaries"
  ON public.ai_conversation_summaries FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete their conversation summaries"
  ON public.ai_conversation_summaries FOR DELETE
  USING (public.user_has_tenant_access(tenant_id) AND user_id = auth.uid());

-- 3. Trigger para updated_at
CREATE TRIGGER update_ai_memories_updated_at
  BEFORE UPDATE ON public.ai_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Função para buscar memórias relevantes (usada pelas edge functions)
CREATE OR REPLACE FUNCTION public.get_ai_memories(
  p_tenant_id UUID,
  p_user_id UUID,
  p_ai_agent TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  category TEXT,
  content TEXT,
  importance INTEGER,
  scope TEXT, -- 'tenant' ou 'user'
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    m.id,
    m.category,
    m.content,
    m.importance,
    CASE WHEN m.user_id IS NULL THEN 'tenant' ELSE 'user' END AS scope,
    m.created_at
  FROM public.ai_memories m
  WHERE m.tenant_id = p_tenant_id
    AND (m.user_id IS NULL OR m.user_id = p_user_id)
    AND (m.ai_agent = p_ai_agent OR m.ai_agent = 'all')
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.importance DESC, m.created_at DESC
  LIMIT p_limit;
$$;

-- 5. Função para buscar resumos recentes
CREATE OR REPLACE FUNCTION public.get_recent_conversation_summaries(
  p_tenant_id UUID,
  p_user_id UUID,
  p_ai_agent TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  summary TEXT,
  key_topics TEXT[],
  key_decisions JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    s.summary,
    s.key_topics,
    s.key_decisions,
    s.created_at
  FROM public.ai_conversation_summaries s
  WHERE s.tenant_id = p_tenant_id
    AND s.user_id = p_user_id
    AND s.ai_agent = p_ai_agent
  ORDER BY s.created_at DESC
  LIMIT p_limit;
$$;
