-- =============================================
-- EMAIL MARKETING + QUIZZ MODULE
-- =============================================

-- A) Email Marketing Lists
CREATE TABLE public.email_marketing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_marketing_lists_tenant ON public.email_marketing_lists(tenant_id);

-- B) Email Marketing Subscribers
CREATE TABLE public.email_marketing_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_email_marketing_subscribers_tenant ON public.email_marketing_subscribers(tenant_id);
CREATE INDEX idx_email_marketing_subscribers_email ON public.email_marketing_subscribers(tenant_id, email);
CREATE INDEX idx_email_marketing_subscribers_status ON public.email_marketing_subscribers(tenant_id, status);

-- C) Email Marketing List Members
CREATE TABLE public.email_marketing_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.email_marketing_lists(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.email_marketing_subscribers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, list_id, subscriber_id)
);

CREATE INDEX idx_email_marketing_list_members_list ON public.email_marketing_list_members(list_id);

-- D) Email Marketing Forms
CREATE TABLE public.email_marketing_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  config JSONB DEFAULT '{"fields": [{"name": "email", "label": "Email", "type": "email", "required": true}]}',
  list_id UUID REFERENCES public.email_marketing_lists(id) ON DELETE SET NULL,
  success_message TEXT DEFAULT 'Obrigado por se inscrever!',
  tags_to_add TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_email_marketing_forms_tenant ON public.email_marketing_forms(tenant_id);
CREATE INDEX idx_email_marketing_forms_slug ON public.email_marketing_forms(tenant_id, slug);

-- E) Quizzes
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  intro_text TEXT,
  outro_text TEXT,
  settings JSONB DEFAULT '{}',
  list_id UUID REFERENCES public.email_marketing_lists(id) ON DELETE SET NULL,
  tags_to_add TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_quizzes_tenant ON public.quizzes(tenant_id);
CREATE INDEX idx_quizzes_slug ON public.quizzes(tenant_id, slug);

-- F) Quiz Questions
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('single', 'multi', 'text', 'email', 'phone', 'name')),
  question TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  is_required BOOLEAN DEFAULT true,
  mapping JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, order_index);

-- G) Quiz Responses
CREATE TABLE public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscriber_id UUID REFERENCES public.email_marketing_subscribers(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_quiz_responses_quiz ON public.quiz_responses(quiz_id);
CREATE INDEX idx_quiz_responses_tenant ON public.quiz_responses(tenant_id);

-- H) Email Marketing Templates
CREATE TABLE public.email_marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_marketing_templates_tenant ON public.email_marketing_templates(tenant_id);

-- I) Email Marketing Campaigns
CREATE TABLE public.email_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('broadcast', 'automation')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  list_id UUID REFERENCES public.email_marketing_lists(id) ON DELETE SET NULL,
  segment JSONB,
  template_id UUID REFERENCES public.email_marketing_templates(id) ON DELETE SET NULL,
  trigger_type TEXT,
  trigger_config JSONB DEFAULT '{}',
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_marketing_campaigns_tenant ON public.email_marketing_campaigns(tenant_id);
CREATE INDEX idx_email_marketing_campaigns_status ON public.email_marketing_campaigns(tenant_id, status);

-- J) Email Marketing Campaign Steps (for automations)
CREATE TABLE public.email_marketing_campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.email_marketing_campaigns(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL DEFAULT 0,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  template_id UUID REFERENCES public.email_marketing_templates(id) ON DELETE SET NULL,
  conditions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_marketing_campaign_steps_campaign ON public.email_marketing_campaign_steps(campaign_id, step_index);

-- K) Email Send Queue
CREATE TABLE public.email_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.email_marketing_campaigns(id) ON DELETE SET NULL,
  subscriber_id UUID REFERENCES public.email_marketing_subscribers(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_queue_dispatch ON public.email_send_queue(tenant_id, status, scheduled_at);
CREATE INDEX idx_email_send_queue_campaign ON public.email_send_queue(campaign_id);

-- L) Email Events
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES public.email_marketing_subscribers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('subscribed', 'unsubscribed', 'quiz_completed', 'email_sent', 'email_failed', 'form_submitted')),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_events_tenant ON public.email_events(tenant_id);
CREATE INDEX idx_email_events_subscriber ON public.email_events(subscriber_id);
CREATE INDEX idx_email_events_type ON public.email_events(tenant_id, event_type, created_at);

-- M) Unsubscribe Tokens
CREATE TABLE public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES public.email_marketing_subscribers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_email_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.email_marketing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- Helper function to check tenant membership
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
  )
$$;

-- email_marketing_lists policies
CREATE POLICY "Tenant members can view lists"
  ON public.email_marketing_lists FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage lists"
  ON public.email_marketing_lists FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_marketing_subscribers policies
CREATE POLICY "Tenant members can view subscribers"
  ON public.email_marketing_subscribers FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage subscribers"
  ON public.email_marketing_subscribers FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_marketing_list_members policies
CREATE POLICY "Tenant members can view list members"
  ON public.email_marketing_list_members FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage list members"
  ON public.email_marketing_list_members FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_marketing_forms policies
CREATE POLICY "Tenant members can view forms"
  ON public.email_marketing_forms FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage forms"
  ON public.email_marketing_forms FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- quizzes policies
CREATE POLICY "Tenant members can view quizzes"
  ON public.quizzes FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage quizzes"
  ON public.quizzes FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- quiz_questions policies
CREATE POLICY "Tenant members can view quiz questions"
  ON public.quiz_questions FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage quiz questions"
  ON public.quiz_questions FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- quiz_responses policies
CREATE POLICY "Tenant members can view quiz responses"
  ON public.quiz_responses FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage quiz responses"
  ON public.quiz_responses FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_marketing_templates policies
CREATE POLICY "Tenant members can view templates"
  ON public.email_marketing_templates FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage templates"
  ON public.email_marketing_templates FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_marketing_campaigns policies
CREATE POLICY "Tenant members can view campaigns"
  ON public.email_marketing_campaigns FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage campaigns"
  ON public.email_marketing_campaigns FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_marketing_campaign_steps policies
CREATE POLICY "Tenant members can view campaign steps"
  ON public.email_marketing_campaign_steps FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage campaign steps"
  ON public.email_marketing_campaign_steps FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_send_queue policies
CREATE POLICY "Tenant members can view send queue"
  ON public.email_send_queue FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage send queue"
  ON public.email_send_queue FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_events policies
CREATE POLICY "Tenant members can view events"
  ON public.email_events FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage events"
  ON public.email_events FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- email_unsubscribe_tokens policies
CREATE POLICY "Tenant members can view unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR SELECT
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

CREATE POLICY "Tenant members can manage unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR ALL
  USING (public.user_has_tenant_access(tenant_id) OR public.is_platform_admin_by_auth());

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_email_marketing_lists_updated_at
  BEFORE UPDATE ON public.email_marketing_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_marketing_subscribers_updated_at
  BEFORE UPDATE ON public.email_marketing_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_marketing_forms_updated_at
  BEFORE UPDATE ON public.email_marketing_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_marketing_templates_updated_at
  BEFORE UPDATE ON public.email_marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.email_marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_send_queue_updated_at
  BEFORE UPDATE ON public.email_send_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Generate unsubscribe token
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(p_tenant_id UUID, p_subscriber_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO public.email_unsubscribe_tokens (tenant_id, subscriber_id, token)
  VALUES (p_tenant_id, p_subscriber_id, v_token)
  ON CONFLICT DO NOTHING;
  
  RETURN v_token;
END;
$$;

-- Normalize email helper
CREATE OR REPLACE FUNCTION public.normalize_email(p_email TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT LOWER(TRIM(p_email))
$$;