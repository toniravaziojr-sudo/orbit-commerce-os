-- Create function to automatically create default email folders when a mailbox is created
CREATE OR REPLACE FUNCTION public.create_default_email_folders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default folders for the new mailbox
  INSERT INTO public.email_folders (mailbox_id, name, slug, icon, is_system, sort_order)
  VALUES 
    (NEW.id, 'Entrada', 'inbox', 'inbox', true, 1),
    (NEW.id, 'Enviados', 'sent', 'send', true, 2),
    (NEW.id, 'Rascunhos', 'drafts', 'file-text', true, 3),
    (NEW.id, 'Spam', 'spam', 'alert-circle', true, 4),
    (NEW.id, 'Lixeira', 'trash', 'trash-2', true, 5);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to run the function after mailbox insert
DROP TRIGGER IF EXISTS trigger_create_default_email_folders ON public.mailboxes;
CREATE TRIGGER trigger_create_default_email_folders
  AFTER INSERT ON public.mailboxes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_email_folders();