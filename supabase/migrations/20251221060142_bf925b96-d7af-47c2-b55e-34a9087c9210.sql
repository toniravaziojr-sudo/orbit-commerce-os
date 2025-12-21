-- =====================================================
-- ETAPA 3.1: Central de Notificações - Modelo de Dados
-- =====================================================

-- 1) events_inbox: eventos canônicos (internos/externos) com idempotência
CREATE TABLE public.events_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'internal', -- 'internal' ou 'external:<name>'
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  provider_event_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_raw jsonb DEFAULT '{}'::jsonb,
  payload_normalized jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new', -- new/processed/ignored/error
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint de idempotência por tenant
ALTER TABLE public.events_inbox 
  ADD CONSTRAINT events_inbox_tenant_idempotency_unique 
  UNIQUE (tenant_id, idempotency_key);

-- Índices para events_inbox
CREATE INDEX idx_events_inbox_tenant_status_received 
  ON public.events_inbox (tenant_id, status, received_at DESC);
CREATE INDEX idx_events_inbox_tenant_event_occurred 
  ON public.events_inbox (tenant_id, event_type, occurred_at DESC);

-- RLS para events_inbox
ALTER TABLE public.events_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events of their tenant"
  ON public.events_inbox FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage events"
  ON public.events_inbox FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

-- 2) notification_rules: regras if/then por tenant
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  trigger_event_type text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb, -- condições adicionais
  actions jsonb DEFAULT '[]'::jsonb, -- lista de ações a executar
  priority int NOT NULL DEFAULT 0,
  dedupe_scope text DEFAULT 'order', -- 'order'|'customer'|'cart'|'none'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para notification_rules
CREATE INDEX idx_notification_rules_tenant_enabled 
  ON public.notification_rules (tenant_id, is_enabled, trigger_event_type);

-- RLS para notification_rules
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rules of their tenant"
  ON public.notification_rules FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage notification rules"
  ON public.notification_rules FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

-- Trigger para updated_at
CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) notifications: fila central com agendamento
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events_inbox(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  channel text NOT NULL, -- 'email'|'whatsapp'|'sms'|'push'
  recipient text NOT NULL, -- email, phone, etc.
  template_key text,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled/sending/sent/failed/canceled/retrying
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint de dedupe por tenant
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_tenant_dedupe_unique 
  UNIQUE (tenant_id, dedupe_key);

-- Índices para notifications (fila)
CREATE INDEX idx_notifications_tenant_status_next 
  ON public.notifications (tenant_id, status, next_attempt_at);
CREATE INDEX idx_notifications_tenant_created 
  ON public.notifications (tenant_id, created_at DESC);
CREATE INDEX idx_notifications_pending_queue 
  ON public.notifications (status, next_attempt_at) 
  WHERE status IN ('scheduled', 'retrying');

-- RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications of their tenant"
  ON public.notifications FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
    has_role(auth.uid(), tenant_id, 'admin'::app_role) OR
    has_role(auth.uid(), tenant_id, 'operator'::app_role)
  );

-- Trigger para updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) notification_attempts: histórico de tentativas
CREATE TABLE public.notification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  attempt_no int NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- pending/success/error
  provider_response jsonb,
  error_code text,
  error_message text
);

-- Índice para attempts
CREATE INDEX idx_notification_attempts_notification 
  ON public.notification_attempts (tenant_id, notification_id, attempt_no);

-- RLS para notification_attempts
ALTER TABLE public.notification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attempts of their tenant"
  ON public.notification_attempts FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage attempts"
  ON public.notification_attempts FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );

-- 5) notification_dedup_ledger: "enviar apenas uma vez" por entidade
CREATE TABLE public.notification_dedup_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.notification_rules(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- 'order'|'customer'|'cart'
  entity_id text NOT NULL,
  scope_key text DEFAULT '', -- ex: abandonment_seq, window
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint única para "enviar uma vez"
ALTER TABLE public.notification_dedup_ledger 
  ADD CONSTRAINT dedup_ledger_unique 
  UNIQUE (tenant_id, rule_id, entity_type, entity_id, scope_key);

-- Índice para busca rápida
CREATE INDEX idx_dedup_ledger_lookup 
  ON public.notification_dedup_ledger (tenant_id, rule_id, entity_type, entity_id);

-- RLS para notification_dedup_ledger
ALTER TABLE public.notification_dedup_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dedup ledger of their tenant"
  ON public.notification_dedup_ledger FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage dedup ledger"
  ON public.notification_dedup_ledger FOR ALL
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
    has_role(auth.uid(), tenant_id, 'admin'::app_role)
  );