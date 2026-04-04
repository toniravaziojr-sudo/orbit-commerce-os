
-- Add unique index for standalone templates (no rule_id) keyed by template_name
CREATE UNIQUE INDEX idx_wts_tenant_template_name_standalone 
  ON public.whatsapp_template_submissions (tenant_id, template_name) 
  WHERE rule_id IS NULL;
