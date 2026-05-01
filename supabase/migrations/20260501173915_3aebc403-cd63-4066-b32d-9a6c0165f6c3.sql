-- =========================================================
-- ONDA 1: Sincronia Total Pedidos ↔ Fiscal/Logística/Cliente
-- =========================================================

-- ---------- 1) Novas colunas em shipments ----------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS requires_action BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS action_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_shipments_requires_action
  ON public.shipments(tenant_id, requires_action)
  WHERE requires_action = TRUE;

-- ---------- 2) Cancelamento em filas ----------
ALTER TABLE public.fiscal_draft_queue
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE public.shipping_draft_queue
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE public.gateway_sync_queue
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ---------- 3) Alerta FISCAL expandido ----------
CREATE OR REPLACE FUNCTION public.handle_order_fiscal_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost',
    'payment_expired', 'invoice_cancelled'
  ];
BEGIN
  IF NEW.status = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status = ANY(v_regression_states))) THEN
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
$function$;

-- ---------- 4) Alerta LOGÍSTICO (novo) ----------
CREATE OR REPLACE FUNCTION public.handle_order_shipping_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost',
    'payment_expired', 'invoice_cancelled'
  ];
BEGIN
  IF NEW.status = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status = ANY(v_regression_states))) THEN
    UPDATE public.shipments
    SET
      requires_action = TRUE,
      action_reason = NEW.status,
      updated_at = now()
    WHERE order_id = NEW.id
      AND requires_action = FALSE
      AND (delivered_at IS NULL);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_order_status_shipping_alert ON public.orders;
CREATE TRIGGER on_order_status_shipping_alert
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_shipping_alert();

-- ---------- 5) Cancelar rascunhos pendentes em filas ----------
CREATE OR REPLACE FUNCTION public.cancel_pending_drafts_on_regression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost',
    'payment_expired', 'invoice_cancelled'
  ];
BEGIN
  IF NEW.status = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status = ANY(v_regression_states))) THEN

    UPDATE public.fiscal_draft_queue
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'order_regression:' || NEW.status
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing');

    UPDATE public.shipping_draft_queue
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'order_regression:' || NEW.status
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing');

    UPDATE public.gateway_sync_queue
    SET status = 'cancelled',
        cancelled_at = now(),
        cancel_reason = 'order_regression:' || NEW.status
    WHERE order_id = NEW.id
      AND status IN ('pending', 'processing');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_order_regression_cancel_drafts ON public.orders;
CREATE TRIGGER on_order_regression_cancel_drafts
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_pending_drafts_on_regression();

-- ---------- 6) Reversão de métricas do cliente ----------
CREATE OR REPLACE FUNCTION public.handle_customer_regression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost'
  ];
BEGIN
  -- Trigger only when order moves INTO a regression state from a non-regression state
  IF NEW.status = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status = ANY(v_regression_states)))
     AND NEW.customer_email IS NOT NULL
     AND TRIM(NEW.customer_email) <> '' THEN

    BEGIN
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);
    EXCEPTION WHEN OTHERS THEN
      -- Non-blocking: log but never break the order update
      RAISE WARNING '[handle_customer_regression] recalc failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_order_regression_customer_sync ON public.orders;
CREATE TRIGGER on_order_regression_customer_sync
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_customer_regression();