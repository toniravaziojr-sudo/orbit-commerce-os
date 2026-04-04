
-- Fix trigger: must be BEFORE INSERT OR UPDATE to modify NEW values (customer_id, is_first_sale)
DROP TRIGGER IF EXISTS trg_recalc_customer_metrics_on_order ON public.orders;

CREATE TRIGGER trg_recalc_customer_metrics_on_order
  BEFORE INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recalc_customer_on_order();

-- Also ensure the other payment trigger fires on UPDATE too
DROP TRIGGER IF EXISTS trg_auto_tag_cliente_on_payment ON public.orders;

CREATE TRIGGER trg_auto_tag_cliente_on_payment
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'approved' AND OLD.payment_status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION public.auto_tag_cliente_on_payment_approved();
