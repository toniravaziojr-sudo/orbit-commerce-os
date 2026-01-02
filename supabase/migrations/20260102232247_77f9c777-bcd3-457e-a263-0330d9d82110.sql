-- Add fiscal alerts fields to fiscal_invoices
ALTER TABLE public.fiscal_invoices 
ADD COLUMN IF NOT EXISTS requires_action BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS action_reason TEXT,
ADD COLUMN IF NOT EXISTS action_dismissed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster alert queries
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_requires_action 
ON public.fiscal_invoices(tenant_id, requires_action) 
WHERE requires_action = TRUE;

-- Function to automatically flag invoices when order status changes
CREATE OR REPLACE FUNCTION public.handle_order_fiscal_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- When order changes to cancelled or returned, flag associated invoices
  IF NEW.status IN ('cancelled', 'returned') AND OLD.status NOT IN ('cancelled', 'returned') THEN
    UPDATE public.fiscal_invoices
    SET 
      requires_action = TRUE,
      action_reason = NEW.status,
      updated_at = now()
    WHERE order_id = NEW.id
      AND status = 'authorized'
      AND requires_action = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_order_status_fiscal_alert ON public.orders;
CREATE TRIGGER on_order_status_fiscal_alert
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_fiscal_alert();