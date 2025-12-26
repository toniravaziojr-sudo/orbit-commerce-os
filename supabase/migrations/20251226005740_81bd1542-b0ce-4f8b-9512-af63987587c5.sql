-- Add delay configuration to system email templates
ALTER TABLE public.system_email_templates 
ADD COLUMN IF NOT EXISTS send_delay_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_send BOOLEAN DEFAULT FALSE;

-- Set tutorials to send 60 minutes after account creation
UPDATE public.system_email_templates 
SET send_delay_minutes = 60, auto_send = TRUE 
WHERE template_key = 'tutorials';

-- Add comment
COMMENT ON COLUMN public.system_email_templates.send_delay_minutes IS 'Delay in minutes before sending the email (0 = immediate)';
COMMENT ON COLUMN public.system_email_templates.auto_send IS 'Whether this email should be sent automatically';