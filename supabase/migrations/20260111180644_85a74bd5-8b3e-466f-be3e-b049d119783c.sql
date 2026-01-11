-- =============================================
-- SUPPORT CENTER TABLES (tenant support tickets)
-- =============================================

-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

-- Support ticket messages table
CREATE TABLE public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('tenant', 'platform')),
  sender_user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support ticket attachments table (references public.files)
CREATE TABLE public.support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_tickets_tenant_id ON public.support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_by ON public.support_tickets(created_by);
CREATE INDEX idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
CREATE INDEX idx_support_ticket_attachments_message_id ON public.support_ticket_attachments(message_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper function to check if user is platform admin
-- =============================================
CREATE OR REPLACE FUNCTION public.is_platform_admin_by_auth()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    JOIN auth.users au ON LOWER(pa.email) = LOWER(au.email)
    WHERE au.id = auth.uid() AND pa.is_active = true
  )
$$;

-- =============================================
-- RLS POLICIES - support_tickets
-- =============================================

-- Tenant users can view their own tenant's tickets
CREATE POLICY "Tenant users can view own tenant tickets"
ON public.support_tickets
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Tenant users can create tickets for their tenant
CREATE POLICY "Tenant users can create tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Tenant users can update their tenant's tickets (e.g., close)
CREATE POLICY "Tenant users can update own tenant tickets"
ON public.support_tickets
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Platform admins can view all tickets
CREATE POLICY "Platform admins can view all tickets"
ON public.support_tickets
FOR SELECT
USING (public.is_platform_admin_by_auth());

-- Platform admins can update all tickets
CREATE POLICY "Platform admins can update all tickets"
ON public.support_tickets
FOR UPDATE
USING (public.is_platform_admin_by_auth());

-- =============================================
-- RLS POLICIES - support_ticket_messages
-- =============================================

-- Tenant users can view messages from their tenant's tickets
CREATE POLICY "Tenant users can view own tenant messages"
ON public.support_ticket_messages
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Tenant users can create messages on their tenant's tickets
CREATE POLICY "Tenant users can create messages"
ON public.support_ticket_messages
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
  AND sender_type = 'tenant'
  AND sender_user_id = auth.uid()
);

-- Platform admins can view all messages
CREATE POLICY "Platform admins can view all messages"
ON public.support_ticket_messages
FOR SELECT
USING (public.is_platform_admin_by_auth());

-- Platform admins can create messages (as platform sender)
CREATE POLICY "Platform admins can create messages"
ON public.support_ticket_messages
FOR INSERT
WITH CHECK (
  public.is_platform_admin_by_auth()
  AND sender_type = 'platform'
  AND sender_user_id = auth.uid()
);

-- =============================================
-- RLS POLICIES - support_ticket_attachments
-- =============================================

-- Tenant users can view attachments from their tenant's messages
CREATE POLICY "Tenant users can view own tenant attachments"
ON public.support_ticket_attachments
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Tenant users can create attachments on their tenant's messages
CREATE POLICY "Tenant users can create attachments"
ON public.support_ticket_attachments
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Platform admins can view all attachments
CREATE POLICY "Platform admins can view all attachments"
ON public.support_ticket_attachments
FOR SELECT
USING (public.is_platform_admin_by_auth());

-- Platform admins can create attachments
CREATE POLICY "Platform admins can create attachments"
ON public.support_ticket_attachments
FOR INSERT
WITH CHECK (public.is_platform_admin_by_auth());

-- =============================================
-- TRIGGER for updated_at on support_tickets
-- =============================================
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();