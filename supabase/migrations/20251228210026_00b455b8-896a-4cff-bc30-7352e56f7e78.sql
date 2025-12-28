
-- Remove the duplicate trigger (keep only one)
DROP TRIGGER IF EXISTS trigger_create_default_email_folders ON public.mailboxes;
