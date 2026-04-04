
-- Create wrapper function for trigger
CREATE OR REPLACE FUNCTION public.trigger_ensure_default_email_marketing_lists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.ensure_default_email_marketing_lists(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger on tenants table
CREATE TRIGGER trigger_default_email_marketing_lists
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.trigger_ensure_default_email_marketing_lists();
