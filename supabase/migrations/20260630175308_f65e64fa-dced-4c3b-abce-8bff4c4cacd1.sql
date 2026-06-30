CREATE OR REPLACE FUNCTION public.cancel_meli_invoice_queue_on_order_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.meli_invoice_send_queue
    SET status = 'cancelled',
        last_error = COALESCE('Pedido cancelado pelo comprador: ' || NEW.cancellation_reason,
                              'Pedido cancelado pelo comprador'),
        updated_at = now()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing', 'failed');
  END IF;
  RETURN NEW;
END;
$function$;