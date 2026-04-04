
-- Allow whatsapp_template_submissions to exist without a notification rule
-- This is needed for standalone templates like the Agenda reminder template
ALTER TABLE public.whatsapp_template_submissions 
  ALTER COLUMN rule_id DROP NOT NULL;
