-- Create table for scheduled system emails
CREATE TABLE IF NOT EXISTS public.scheduled_system_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  user_name TEXT,
  template_key TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  provider_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_key)
);

-- Enable RLS
ALTER TABLE public.scheduled_system_emails ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (internal use only)
CREATE POLICY "Service role only" ON public.scheduled_system_emails
  FOR ALL USING (false);

-- Index for processing scheduled emails
CREATE INDEX idx_scheduled_emails_status_scheduled 
  ON public.scheduled_system_emails (status, scheduled_for) 
  WHERE status = 'scheduled';

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_emails_updated_at
  BEFORE UPDATE ON public.scheduled_system_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();