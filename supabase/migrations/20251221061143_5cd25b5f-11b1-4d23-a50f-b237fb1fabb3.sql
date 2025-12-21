-- PATCH 3.1.1: Fix RLS policies (separate by command with WITH CHECK) and add status CHECK constraints

-- ============================================
-- A) DROP existing "FOR ALL" policies
-- ============================================

-- events_inbox
DROP POLICY IF EXISTS "Admins can manage events" ON public.events_inbox;
DROP POLICY IF EXISTS "Users can view events of their tenant" ON public.events_inbox;

-- notification_rules
DROP POLICY IF EXISTS "Admins can manage notification rules" ON public.notification_rules;
DROP POLICY IF EXISTS "Users can view rules of their tenant" ON public.notification_rules;

-- notifications
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view notifications of their tenant" ON public.notifications;

-- notification_attempts
DROP POLICY IF EXISTS "Admins can manage attempts" ON public.notification_attempts;
DROP POLICY IF EXISTS "Users can view attempts of their tenant" ON public.notification_attempts;

-- notification_dedup_ledger
DROP POLICY IF EXISTS "Admins can manage dedup ledger" ON public.notification_dedup_ledger;
DROP POLICY IF EXISTS "Users can view dedup ledger of their tenant" ON public.notification_dedup_ledger;

-- ============================================
-- B) CREATE separate policies per command
-- ============================================

-- ----------------
-- events_inbox
-- ----------------
CREATE POLICY "Users can view events of their tenant"
ON public.events_inbox FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert events"
ON public.events_inbox FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can update events"
ON public.events_inbox FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can delete events"
ON public.events_inbox FOR DELETE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

-- ----------------
-- notification_rules
-- ----------------
CREATE POLICY "Users can view rules of their tenant"
ON public.notification_rules FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert rules"
ON public.notification_rules FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can update rules"
ON public.notification_rules FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can delete rules"
ON public.notification_rules FOR DELETE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

-- ----------------
-- notifications
-- ----------------
CREATE POLICY "Users can view notifications of their tenant"
ON public.notifications FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin') OR
  has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can update notifications"
ON public.notifications FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin') OR
  has_role(auth.uid(), tenant_id, 'operator')
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin') OR
  has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can delete notifications"
ON public.notifications FOR DELETE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

-- ----------------
-- notification_attempts
-- ----------------
CREATE POLICY "Users can view attempts of their tenant"
ON public.notification_attempts FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert attempts"
ON public.notification_attempts FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can update attempts"
ON public.notification_attempts FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

-- notification_attempts geralmente não são deletados (histórico)
-- mas adicionamos para completude
CREATE POLICY "Admins can delete attempts"
ON public.notification_attempts FOR DELETE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

-- ----------------
-- notification_dedup_ledger
-- ----------------
CREATE POLICY "Users can view dedup ledger of their tenant"
ON public.notification_dedup_ledger FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert dedup ledger"
ON public.notification_dedup_ledger FOR INSERT
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can update dedup ledger"
ON public.notification_dedup_ledger FOR UPDATE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

CREATE POLICY "Admins can delete dedup ledger"
ON public.notification_dedup_ledger FOR DELETE
USING (
  has_role(auth.uid(), tenant_id, 'owner') OR
  has_role(auth.uid(), tenant_id, 'admin')
);

-- ============================================
-- C) ADD CHECK constraints for status fields
-- ============================================

-- events_inbox.status
ALTER TABLE public.events_inbox
ADD CONSTRAINT events_inbox_status_check
CHECK (status IN ('new', 'processed', 'ignored', 'error'));

-- notifications.status
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_status_check
CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'canceled', 'retrying'));

-- notification_attempts.status
ALTER TABLE public.notification_attempts
ADD CONSTRAINT notification_attempts_status_check
CHECK (status IN ('pending', 'success', 'error'));