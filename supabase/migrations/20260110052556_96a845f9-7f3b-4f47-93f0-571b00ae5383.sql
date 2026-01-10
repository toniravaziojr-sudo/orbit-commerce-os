-- Tabela para armazenar mensagens/perguntas do ML
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.marketplace_connections(id) ON DELETE SET NULL,
  marketplace TEXT NOT NULL DEFAULT 'mercadolivre',
  
  -- Identificadores externos
  external_message_id TEXT NOT NULL,
  external_order_id TEXT,
  external_item_id TEXT,
  external_thread_id TEXT,
  
  -- Tipo: question (pré-venda) ou message (pós-venda)
  message_type TEXT NOT NULL CHECK (message_type IN ('question', 'message')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'unanswered' CHECK (status IN ('unanswered', 'answered', 'closed', 'deleted')),
  
  -- Dados do comprador/perguntador
  buyer_id TEXT,
  buyer_nickname TEXT,
  
  -- Conteúdo
  question_text TEXT,
  answer_text TEXT,
  answered_at TIMESTAMPTZ,
  
  -- Item relacionado (para perguntas de anúncio)
  item_title TEXT,
  item_thumbnail TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, marketplace, external_message_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_tenant_status ON public.marketplace_messages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_tenant_type ON public.marketplace_messages(tenant_id, message_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_connection ON public.marketplace_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_external_order ON public.marketplace_messages(tenant_id, external_order_id);

-- RLS
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

-- Policy: membros do tenant podem ler
CREATE POLICY "Tenant members can view marketplace messages"
ON public.marketplace_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = marketplace_messages.tenant_id
  )
);

-- Policy: admins/owners podem inserir/atualizar
CREATE POLICY "Tenant admins can manage marketplace messages"
ON public.marketplace_messages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = marketplace_messages.tenant_id
      AND ur.role IN ('owner', 'admin', 'operator')
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_marketplace_messages_updated_at
  BEFORE UPDATE ON public.marketplace_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();