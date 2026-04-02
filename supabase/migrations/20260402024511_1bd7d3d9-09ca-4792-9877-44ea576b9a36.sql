
-- Trigger function that calls fiscal-auto-create-drafts edge function in TRIGGER mode
CREATE OR REPLACE FUNCTION public.trg_fiscal_draft_on_payment_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only fire when payment_status changes TO 'approved'
  IF (TG_OP = 'UPDATE' 
      AND NEW.payment_status = 'approved' 
      AND (OLD.payment_status IS DISTINCT FROM 'approved')) THEN

    -- Get Supabase URL and anon key from vault or hardcode project URL
    _supabase_url := 'https://ojssezfjhdvvncsqyhyq.supabase.co';
    _anon_key := current_setting('app.settings.anon_key', true);

    -- If anon_key not in app settings, use the known key
    IF _anon_key IS NULL OR _anon_key = '' THEN
      _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3NlemZqaGR2dm5jc3F5aHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcyMDksImV4cCI6MjA4MTE2MzIwOX0.xijqzFrwy221qrnnwU2PAH7Kk6Qm2AlfXhbk6uEVAVg';
    END IF;

    -- Call edge function asynchronously via pg_net
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/fiscal-auto-create-drafts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object(
        'order_id', NEW.id::text,
        'tenant_id', NEW.tenant_id::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on orders table
DROP TRIGGER IF EXISTS trg_fiscal_draft_on_payment_approved ON public.orders;
CREATE TRIGGER trg_fiscal_draft_on_payment_approved
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fiscal_draft_on_payment_approved();
