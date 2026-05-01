
-- ============================================================
-- Fix Sincronia Total Onda 1 — enum vs text[] em ANY()
-- Problema: NEW.status (enum order_status) comparado com TEXT[]
-- causava ERRO 42883 em TODA UPDATE em public.orders, travando
-- pagamentos, cancelamentos, webhooks e cron de expiração.
-- Correção: cast NEW.status::text e OLD.status::text.
-- Mantém 100% da semântica e dos triggers ATTACH existentes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_pending_drafts_on_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
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
$$;

CREATE OR REPLACE FUNCTION public.handle_customer_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost'
  ];
BEGIN
  IF NEW.status::text = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status::text = ANY(v_regression_states)))
     AND NEW.customer_email IS NOT NULL
     AND TRIM(NEW.customer_email) <> '' THEN

    BEGIN
      PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[handle_customer_regression] recalc failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_order_fiscal_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost',
    'payment_expired', 'invoice_cancelled'
  ];
BEGIN
  IF NEW.status::text = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status::text = ANY(v_regression_states))) THEN
    UPDATE public.fiscal_invoices
    SET
      requires_action = TRUE,
      action_reason = NEW.status::text,
      updated_at = now()
    WHERE order_id = NEW.id
      AND status = 'authorized'
      AND requires_action = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_order_shipping_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regression_states TEXT[] := ARRAY[
    'cancelled', 'returned', 'returning',
    'chargeback_detected', 'chargeback_lost',
    'payment_expired', 'invoice_cancelled'
  ];
BEGIN
  IF NEW.status::text = ANY(v_regression_states)
     AND (OLD.status IS NULL OR NOT (OLD.status::text = ANY(v_regression_states))) THEN
    UPDATE public.shipments
    SET
      requires_action = TRUE,
      action_reason = NEW.status::text,
      updated_at = now()
    WHERE order_id = NEW.id
      AND requires_action = FALSE
      AND (delivered_at IS NULL);
  END IF;
  RETURN NEW;
END;
$$;
