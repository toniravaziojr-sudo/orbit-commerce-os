ALTER TABLE public.meli_invoice_send_queue
  DROP CONSTRAINT IF EXISTS meli_invoice_send_queue_status_check;

ALTER TABLE public.meli_invoice_send_queue
  ADD CONSTRAINT meli_invoice_send_queue_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text, 'cancelled'::text]));

UPDATE public.meli_invoice_send_queue q
SET status = 'cancelled',
    last_error = COALESCE('Pedido cancelado pelo comprador: ' || o.cancellation_reason,
                          'Pedido cancelado pelo comprador'),
    updated_at = now()
FROM public.orders o
WHERE q.order_id = o.id
  AND o.status = 'cancelled'
  AND q.status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.cancel_meli_invoice_queue_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
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
$$;

DROP TRIGGER IF EXISTS trg_cancel_meli_invoice_queue ON public.orders;
CREATE TRIGGER trg_cancel_meli_invoice_queue
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_meli_invoice_queue_on_order_cancel();