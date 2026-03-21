
-- Table to track WhatsApp template submissions to Meta
CREATE TABLE public.whatsapp_template_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.notification_rules(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_category TEXT NOT NULL DEFAULT 'UTILITY',
  template_language TEXT NOT NULL DEFAULT 'pt_BR',
  template_body TEXT NOT NULL,
  template_header TEXT,
  template_footer TEXT,
  meta_template_id TEXT,
  meta_status TEXT NOT NULL DEFAULT 'pending',
  meta_reject_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, rule_id)
);

-- Add template tracking columns to notification_rules
ALTER TABLE public.notification_rules
  ADD COLUMN IF NOT EXISTS meta_template_name TEXT,
  ADD COLUMN IF NOT EXISTS meta_template_status TEXT DEFAULT 'none';

-- RLS
ALTER TABLE public.whatsapp_template_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own template submissions"
  ON public.whatsapp_template_submissions FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Tenants can insert own template submissions"
  ON public.whatsapp_template_submissions FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_current_tenant_id(auth.uid()));

CREATE POLICY "Tenants can update own template submissions"
  ON public.whatsapp_template_submissions FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_current_tenant_id(auth.uid()));

-- Index for polling
CREATE INDEX idx_wts_pending ON public.whatsapp_template_submissions(meta_status) WHERE meta_status = 'pending';
CREATE INDEX idx_wts_tenant ON public.whatsapp_template_submissions(tenant_id);
