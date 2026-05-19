CREATE OR REPLACE FUNCTION public.cancel_pending_drafts_on_regression()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'cancelled_by_user', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost',
    'payment_expired', 'invoice_cancelled'
  ];
BEGIN
  IF NEW.status::text = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status::text = ANY(v_regression_states))) THEN

    UPDATE public.fiscal_draft_queue
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'order_regression:' || NEW.status::text
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing');

    UPDATE public.shipping_draft_queue
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'order_regression:' || NEW.status::text
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing');

    UPDATE public.gateway_sync_queue
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'order_regression:' || NEW.status::text
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing');
  END IF;
  RETURN NEW;
END;
$function$;