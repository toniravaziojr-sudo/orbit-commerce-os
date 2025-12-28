-- Enum para propósito do email
CREATE TYPE email_purpose AS ENUM ('notifications', 'support', 'manual');

-- Enum para status de conexão do mailbox
CREATE TYPE mailbox_status AS ENUM ('pending_dns', 'active', 'error', 'disabled');

-- Tabela principal de caixas de email
CREATE TABLE public.mailboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT,
  purpose email_purpose NOT NULL DEFAULT 'manual',
  status mailbox_status NOT NULL DEFAULT 'pending_dns',
  
  -- Configuração de domínio
  domain TEXT NOT NULL,
  dns_verified BOOLEAN DEFAULT FALSE,
  dns_records JSONB,
  last_dns_check_at TIMESTAMPTZ,
  
  -- Configuração de envio (Resend)
  resend_domain_id TEXT,
  sending_verified BOOLEAN DEFAULT FALSE,
  
  -- Estatísticas
  unread_count INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  last_received_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  
  -- Metadados
  signature_html TEXT,
  auto_reply_enabled BOOLEAN DEFAULT FALSE,
  auto_reply_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, email_address)
);

-- Pastas de email
CREATE TABLE public.email_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(mailbox_id, slug)
);

-- Mensagens de email
CREATE TABLE public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.email_folders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Identificadores externos
  external_message_id TEXT,
  in_reply_to TEXT,
  thread_id TEXT,
  
  -- Remetente/Destinatários
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB NOT NULL DEFAULT '[]',
  cc_emails JSONB DEFAULT '[]',
  bcc_emails JSONB DEFAULT '[]',
  reply_to TEXT,
  
  -- Conteúdo
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  
  -- Metadados
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,
  labels TEXT[] DEFAULT '{}',
  
  -- Timestamps
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anexos de email
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  content_id TEXT,
  is_inline BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_mailboxes_tenant ON public.mailboxes(tenant_id);
CREATE INDEX idx_mailboxes_purpose ON public.mailboxes(tenant_id, purpose);
CREATE INDEX idx_email_messages_mailbox ON public.email_messages(mailbox_id);
CREATE INDEX idx_email_messages_folder ON public.email_messages(folder_id);
CREATE INDEX idx_email_messages_thread ON public.email_messages(thread_id);
CREATE INDEX idx_email_messages_received ON public.email_messages(mailbox_id, received_at DESC);
CREATE INDEX idx_email_attachments_message ON public.email_attachments(message_id);

-- RLS
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- Policies para mailboxes
CREATE POLICY "Tenant members can view mailboxes"
  ON public.mailboxes FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage mailboxes"
  ON public.mailboxes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND tenant_id = mailboxes.tenant_id
        AND role IN ('owner', 'admin')
    )
  );

-- Policies para folders
CREATE POLICY "Users can view folders of their tenant mailboxes"
  ON public.email_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mailboxes m
      WHERE m.id = email_folders.mailbox_id
        AND user_belongs_to_tenant(auth.uid(), m.tenant_id)
    )
  );

CREATE POLICY "Admins can manage folders"
  ON public.email_folders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mailboxes m
      JOIN public.user_roles ur ON ur.tenant_id = m.tenant_id
      WHERE m.id = email_folders.mailbox_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Policies para messages
CREATE POLICY "Users can view messages of their tenant"
  ON public.email_messages FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can manage messages of their tenant"
  ON public.email_messages FOR ALL
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Policies para attachments
CREATE POLICY "Users can view attachments of their messages"
  ON public.email_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_messages m
      WHERE m.id = email_attachments.message_id
        AND user_belongs_to_tenant(auth.uid(), m.tenant_id)
    )
  );

CREATE POLICY "Users can manage attachments"
  ON public.email_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.email_messages m
      WHERE m.id = email_attachments.message_id
        AND user_belongs_to_tenant(auth.uid(), m.tenant_id)
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_mailboxes_updated_at
  BEFORE UPDATE ON public.mailboxes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar pastas padrão ao criar mailbox
CREATE OR REPLACE FUNCTION public.create_default_email_folders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.email_folders (mailbox_id, name, slug, icon, is_system, sort_order)
  VALUES
    (NEW.id, 'Entrada', 'inbox', 'inbox', true, 0),
    (NEW.id, 'Enviados', 'sent', 'send', true, 1),
    (NEW.id, 'Rascunhos', 'drafts', 'file-text', true, 2),
    (NEW.id, 'Lixeira', 'trash', 'trash-2', true, 3),
    (NEW.id, 'Spam', 'spam', 'alert-circle', true, 4);
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_mailbox_folders
  AFTER INSERT ON public.mailboxes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_email_folders();

-- Enable realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;