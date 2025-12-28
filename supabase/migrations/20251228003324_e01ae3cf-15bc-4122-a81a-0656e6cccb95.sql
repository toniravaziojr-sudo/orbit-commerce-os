-- =====================================================
-- CENTRAL DE ATENDIMENTO OMNICHANNEL
-- Fase 0+1: Primitivos, Tabelas e Políticas
-- =====================================================

-- Enum para estados da conversa
CREATE TYPE conversation_status AS ENUM (
  'new',           -- Nova conversa, não lida
  'open',          -- Em aberto, aguardando ação
  'waiting_customer', -- Aguardando resposta do cliente
  'waiting_agent',    -- Aguardando agente humano
  'bot',              -- Sendo atendida pela IA
  'resolved',         -- Resolvida/Finalizada
  'spam'              -- Marcada como spam
);

-- Enum para canais suportados
CREATE TYPE support_channel_type AS ENUM (
  'whatsapp',
  'email',
  'facebook_messenger',
  'instagram_dm',
  'mercadolivre',
  'shopee'
);

-- Enum para status de entrega de mensagem
CREATE TYPE message_delivery_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'read',
  'failed'
);

-- Enum para direção da mensagem
CREATE TYPE message_direction AS ENUM (
  'inbound',   -- Cliente -> Loja
  'outbound'   -- Loja -> Cliente
);

-- Enum para tipo de remetente
CREATE TYPE message_sender_type AS ENUM (
  'customer',
  'agent',
  'bot',
  'system'
);

-- =====================================================
-- 1. CHANNEL_ACCOUNTS - Contas de canal por tenant
-- =====================================================
CREATE TABLE public.channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_type support_channel_type NOT NULL,
  account_name TEXT NOT NULL,
  external_account_id TEXT,
  credentials JSONB DEFAULT '{}',
  webhook_url TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 1000,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, channel_type, external_account_id)
);

-- =====================================================
-- 2. CONVERSATIONS - Conversas unificadas
-- =====================================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_account_id UUID REFERENCES public.channel_accounts(id) ON DELETE SET NULL,
  channel_type support_channel_type NOT NULL,
  
  -- Identificadores externos para dedupe
  external_conversation_id TEXT,
  external_thread_id TEXT,
  
  -- Cliente vinculado (merge por telefone/email)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_avatar_url TEXT,
  
  -- Pedido relacionado (se houver)
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  -- Status e atribuição
  status conversation_status DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Métricas SLA
  first_response_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_customer_message_at TIMESTAMPTZ,
  last_agent_message_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Contadores
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  
  -- Prioridade e tags
  priority INTEGER DEFAULT 0, -- 0=normal, 1=alta, 2=urgente
  tags TEXT[] DEFAULT '{}',
  
  -- Satisfação
  csat_score INTEGER,
  csat_feedback TEXT,
  
  -- Metadata
  subject TEXT,
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Dedupe key
  UNIQUE(tenant_id, channel_type, external_conversation_id)
);

-- =====================================================
-- 3. CONVERSATION_PARTICIPANTS - Participantes
-- =====================================================
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  participant_type TEXT NOT NULL, -- 'customer', 'agent', 'bot'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  display_name TEXT,
  avatar_url TEXT,
  
  role TEXT DEFAULT 'participant', -- 'owner', 'participant', 'observer'
  is_active BOOLEAN DEFAULT true,
  
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  
  UNIQUE(conversation_id, user_id),
  UNIQUE(conversation_id, customer_id)
);

-- =====================================================
-- 4. MESSAGES - Mensagens
-- =====================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Dedupe
  external_message_id TEXT,
  idempotency_key TEXT,
  
  -- Direção e remetente
  direction message_direction NOT NULL,
  sender_type message_sender_type NOT NULL,
  sender_id UUID, -- user_id ou customer_id
  sender_name TEXT,
  
  -- Conteúdo
  content TEXT,
  content_type TEXT DEFAULT 'text', -- text, image, audio, video, file, location, sticker
  
  -- Metadata do canal
  channel_metadata JSONB DEFAULT '{}',
  
  -- Status de entrega
  delivery_status message_delivery_status DEFAULT 'queued',
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- IA
  is_ai_generated BOOLEAN DEFAULT false,
  ai_model_used TEXT,
  ai_confidence DECIMAL(3,2),
  ai_context_used JSONB,
  
  -- Mensagem interna (não enviada ao cliente)
  is_internal BOOLEAN DEFAULT false,
  is_note BOOLEAN DEFAULT false,
  
  -- Resposta a mensagem anterior
  reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, external_message_id)
);

-- =====================================================
-- 5. MESSAGE_ATTACHMENTS - Anexos
-- =====================================================
CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  mime_type TEXT,
  file_size INTEGER,
  
  -- Thumbnails para imagens/vídeos
  thumbnail_url TEXT,
  thumbnail_path TEXT,
  
  -- Dimensões para mídia
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  
  -- Transcrição para áudio
  transcription TEXT,
  
  -- Moderação
  is_safe BOOLEAN DEFAULT true,
  moderation_result JSONB,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 6. CONVERSATION_EVENTS - Auditoria
-- =====================================================
CREATE TABLE public.conversation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL, -- 'created', 'assigned', 'transferred', 'status_changed', 'tagged', 'resolved', 'reopened'
  
  actor_type TEXT, -- 'agent', 'bot', 'system', 'customer'
  actor_id UUID,
  actor_name TEXT,
  
  -- Dados do evento
  old_value JSONB,
  new_value JSONB,
  
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 7. QUICK_REPLIES - Respostas rápidas
-- =====================================================
CREATE TABLE public.quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT, -- /saudacao, /rastreio, etc
  
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Variáveis suportadas
  variables TEXT[] DEFAULT '{}', -- {{customer_name}}, {{order_number}}, etc
  
  -- Canais onde pode ser usada
  channels support_channel_type[] DEFAULT '{}',
  
  -- Contadores
  use_count INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 8. AI_SUPPORT_CONFIG - Configuração da IA
-- =====================================================
CREATE TABLE public.ai_support_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Ativação
  is_enabled BOOLEAN DEFAULT true,
  
  -- Personalidade
  personality_name TEXT DEFAULT 'Assistente',
  personality_tone TEXT DEFAULT 'friendly', -- formal, friendly, casual
  use_emojis BOOLEAN DEFAULT true,
  
  -- Prompt do sistema
  system_prompt TEXT,
  
  -- Conhecimento customizado
  custom_knowledge TEXT,
  
  -- Fontes de conhecimento automático
  auto_import_products BOOLEAN DEFAULT true,
  auto_import_categories BOOLEAN DEFAULT true,
  auto_import_policies BOOLEAN DEFAULT true,
  auto_import_faqs BOOLEAN DEFAULT true,
  
  -- Comportamento
  max_messages_before_handoff INTEGER DEFAULT 10,
  handoff_keywords TEXT[] DEFAULT ARRAY['falar com humano', 'atendente', 'pessoa real'],
  
  -- Horário de atendimento
  operating_hours JSONB DEFAULT '{}',
  out_of_hours_message TEXT,
  
  -- Tratamento de mídia
  handle_images BOOLEAN DEFAULT true,
  handle_audio BOOLEAN DEFAULT true,
  handle_files BOOLEAN DEFAULT true,
  image_analysis_prompt TEXT,
  
  -- Modo de aprovação
  approval_mode BOOLEAN DEFAULT false,
  
  -- Proteções
  max_response_length INTEGER DEFAULT 500,
  forbidden_topics TEXT[] DEFAULT '{}',
  
  -- Modelo
  ai_model TEXT DEFAULT 'google/gemini-2.5-flash',
  
  -- SLA
  target_first_response_seconds INTEGER DEFAULT 60,
  target_resolution_minutes INTEGER DEFAULT 30,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 9. SUPPORT_STATS_DAILY - Estatísticas diárias
-- =====================================================
CREATE TABLE public.support_stats_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  
  -- Por canal
  channel_type support_channel_type,
  
  -- Contadores
  conversations_new INTEGER DEFAULT 0,
  conversations_resolved INTEGER DEFAULT 0,
  messages_inbound INTEGER DEFAULT 0,
  messages_outbound INTEGER DEFAULT 0,
  messages_by_ai INTEGER DEFAULT 0,
  messages_by_agent INTEGER DEFAULT 0,
  
  -- Tempos médios (em segundos)
  avg_first_response_time INTEGER,
  avg_resolution_time INTEGER,
  
  -- Satisfação
  csat_responses INTEGER DEFAULT 0,
  csat_total_score INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, stat_date, channel_type)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_conversations_tenant_status ON public.conversations(tenant_id, status);
CREATE INDEX idx_conversations_tenant_channel ON public.conversations(tenant_id, channel_type);
CREATE INDEX idx_conversations_assigned ON public.conversations(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_conversations_customer ON public.conversations(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_conversations_last_message ON public.conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_conversations_unread ON public.conversations(tenant_id, unread_count) WHERE unread_count > 0;

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON public.messages(tenant_id, created_at DESC);
CREATE INDEX idx_messages_external ON public.messages(tenant_id, external_message_id) WHERE external_message_id IS NOT NULL;

CREATE INDEX idx_conversation_events_conversation ON public.conversation_events(conversation_id, created_at);

CREATE INDEX idx_quick_replies_tenant ON public.quick_replies(tenant_id, is_active);
CREATE INDEX idx_quick_replies_shortcut ON public.quick_replies(tenant_id, shortcut) WHERE shortcut IS NOT NULL;

-- =====================================================
-- TRIGGERS - Updated At
-- =====================================================
CREATE TRIGGER update_channel_accounts_updated_at
  BEFORE UPDATE ON public.channel_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quick_replies_updated_at
  BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_support_config_updated_at
  BEFORE UPDATE ON public.ai_support_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION - Atualizar contadores da conversa
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_conversation_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.conversations
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      unread_count = CASE 
        WHEN NEW.direction = 'inbound' THEN unread_count + 1 
        ELSE unread_count 
      END,
      last_customer_message_at = CASE 
        WHEN NEW.sender_type = 'customer' THEN NEW.created_at 
        ELSE last_customer_message_at 
      END,
      last_agent_message_at = CASE 
        WHEN NEW.sender_type IN ('agent', 'bot') THEN NEW.created_at 
        ELSE last_agent_message_at 
      END,
      first_response_at = CASE 
        WHEN first_response_at IS NULL AND NEW.sender_type IN ('agent', 'bot') AND NEW.direction = 'outbound'
        THEN NEW.created_at 
        ELSE first_response_at 
      END
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_conversation_counters
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_counters();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_support_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_stats_daily ENABLE ROW LEVEL SECURITY;

-- Channel Accounts
CREATE POLICY "Tenant members can view channel accounts"
  ON public.channel_accounts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage channel accounts"
  ON public.channel_accounts FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Conversations
CREATE POLICY "Tenant members can view conversations"
  ON public.conversations FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage conversations"
  ON public.conversations FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Participants
CREATE POLICY "Tenant members can view participants"
  ON public.conversation_participants FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage participants"
  ON public.conversation_participants FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Messages
CREATE POLICY "Tenant members can view messages"
  ON public.messages FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage messages"
  ON public.messages FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Attachments
CREATE POLICY "Tenant members can view attachments"
  ON public.message_attachments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage attachments"
  ON public.message_attachments FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Events
CREATE POLICY "Tenant members can view events"
  ON public.conversation_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can insert events"
  ON public.conversation_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Quick Replies
CREATE POLICY "Tenant members can view quick replies"
  ON public.quick_replies FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can manage quick replies"
  ON public.quick_replies FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- AI Config
CREATE POLICY "Tenant members can view ai config"
  ON public.ai_support_config FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage ai config"
  ON public.ai_support_config FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Stats
CREATE POLICY "Tenant members can view stats"
  ON public.support_stats_daily FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "System can manage stats"
  ON public.support_stats_daily FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));