-- =============================================
-- AGENDA MODULE: Tasks and Reminders with WhatsApp notifications
-- =============================================

-- 1) agenda_tasks - Main tasks/reminders table
CREATE TABLE public.agenda_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  is_recurring BOOLEAN DEFAULT false,
  recurrence JSONB, -- { type: 'daily'|'weekly'|'monthly', interval: number, byweekday?: number[], bymonthday?: number }
  reminder_offsets JSONB, -- Array of offsets in minutes: [1440, 120, 15] = 1 day, 2h, 15min before
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) agenda_reminders - Individual reminder notifications
CREATE TABLE public.agenda_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agenda_tasks(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency constraint
  UNIQUE(task_id, remind_at, channel)
);

-- 3) Enable RLS
ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_reminders ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies for agenda_tasks (using role='owner' OR user_type IN ('owner','manager'))

-- SELECT: Any tenant member can view tasks
CREATE POLICY "Tenant members can view agenda tasks"
  ON public.agenda_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_tasks.tenant_id
        AND ur.user_id = auth.uid()
    )
  );

-- INSERT: Owner/Manager can create tasks
CREATE POLICY "Tenant owner/manager can create agenda tasks"
  ON public.agenda_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_tasks.tenant_id
        AND ur.user_id = auth.uid()
        AND (ur.role = 'owner' OR ur.user_type IN ('owner', 'manager'))
    )
  );

-- UPDATE: Owner/Manager can update tasks
CREATE POLICY "Tenant owner/manager can update agenda tasks"
  ON public.agenda_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_tasks.tenant_id
        AND ur.user_id = auth.uid()
        AND (ur.role = 'owner' OR ur.user_type IN ('owner', 'manager'))
    )
  );

-- DELETE: Owner can delete tasks
CREATE POLICY "Tenant owner can delete agenda tasks"
  ON public.agenda_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_tasks.tenant_id
        AND ur.user_id = auth.uid()
        AND (ur.role = 'owner' OR ur.user_type = 'owner')
    )
  );

-- 5) RLS Policies for agenda_reminders (inherit from task)

CREATE POLICY "Tenant members can view agenda reminders"
  ON public.agenda_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_reminders.tenant_id
        AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant owner/manager can create agenda reminders"
  ON public.agenda_reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_reminders.tenant_id
        AND ur.user_id = auth.uid()
        AND (ur.role = 'owner' OR ur.user_type IN ('owner', 'manager'))
    )
  );

CREATE POLICY "Tenant owner/manager can update agenda reminders"
  ON public.agenda_reminders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_reminders.tenant_id
        AND ur.user_id = auth.uid()
        AND (ur.role = 'owner' OR ur.user_type IN ('owner', 'manager'))
    )
  );

CREATE POLICY "Tenant owner can delete agenda reminders"
  ON public.agenda_reminders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = agenda_reminders.tenant_id
        AND ur.user_id = auth.uid()
        AND (ur.role = 'owner' OR ur.user_type = 'owner')
    )
  );

-- 6) Indexes for performance
CREATE INDEX idx_agenda_tasks_tenant_status ON public.agenda_tasks(tenant_id, status);
CREATE INDEX idx_agenda_tasks_due_at ON public.agenda_tasks(due_at);
CREATE INDEX idx_agenda_reminders_dispatch ON public.agenda_reminders(status, remind_at) WHERE status = 'pending';
CREATE INDEX idx_agenda_reminders_task ON public.agenda_reminders(task_id);

-- 7) Updated_at trigger
CREATE TRIGGER update_agenda_tasks_updated_at
  BEFORE UPDATE ON public.agenda_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agenda_reminders_updated_at
  BEFORE UPDATE ON public.agenda_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();