-- ============================================
-- 1. agenda_authorized_phones
-- ============================================

CREATE TABLE public.agenda_authorized_phones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  label TEXT,
  configured_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_agenda_authorized_phones_tenant_phone 
  ON public.agenda_authorized_phones(tenant_id, phone);

ALTER TABLE public.agenda_authorized_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view authorized phones"
  ON public.agenda_authorized_phones FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert authorized phones"
  ON public.agenda_authorized_phones FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update authorized phones"
  ON public.agenda_authorized_phones FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete authorized phones"
  ON public.agenda_authorized_phones FOR DELETE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- ============================================
-- 2. agenda_command_log
-- ============================================

CREATE TABLE public.agenda_command_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'inbound',
  external_message_id TEXT,
  from_phone TEXT,
  content TEXT,
  intent TEXT,
  action_taken TEXT,
  pending_action JSONB,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_agenda_command_log_dedup
  ON public.agenda_command_log(tenant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX idx_agenda_command_log_tenant_status
  ON public.agenda_command_log(tenant_id, status);

ALTER TABLE public.agenda_command_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view command log"
  ON public.agenda_command_log FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert command log"
  ON public.agenda_command_log FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- ============================================
-- 3. agenda_chat_history
-- ============================================

CREATE TABLE public.agenda_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT,
  intent TEXT,
  action_result JSONB,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agenda_chat_history_tenant_created
  ON public.agenda_chat_history(tenant_id, created_at DESC);

ALTER TABLE public.agenda_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view chat history"
  ON public.agenda_chat_history FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert chat history"
  ON public.agenda_chat_history FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

-- ============================================
-- 4. Migração sent → dispatched
-- ============================================

UPDATE public.agenda_reminders
SET status = 'dispatched'
WHERE status = 'sent';

-- ============================================
-- 5. Limpeza de lembretes órfãos
-- ============================================

UPDATE public.agenda_reminders
SET status = 'skipped'
WHERE status = 'pending'
  AND task_id IN (
    SELECT id FROM public.agenda_tasks
    WHERE status IN ('completed', 'cancelled')
  );