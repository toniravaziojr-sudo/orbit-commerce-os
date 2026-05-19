-- Trava: Pedido de Venda só pode ser marcado como cancelado quando o pedido original também estiver em estado terminal/regressivo.
CREATE OR REPLACE FUNCTION public.guard_pv_cancellation_mirrors_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
  v_terminal_states text[] := ARRAY[
    'cancelled','cancelled_by_user','payment_expired',
    'invoice_cancelled','chargeback_lost','returned','returning'
  ];
BEGIN
  -- Só vigia Pedidos de Venda (raiz). NFs filhas (source_order_invoice_id NOT NULL) continuam livres.
  IF NEW.source_order_invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Só bloqueia se a atualização tentar MARCAR como cancelado (transição NULL/outro -> cancelado).
  IF NEW.pedido_status = 'cancelado'
     AND (TG_OP = 'INSERT' OR OLD.pedido_status IS DISTINCT FROM 'cancelado'
          OR OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL)
  THEN
    SELECT o.status::text INTO v_order_status
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    IF v_order_status IS NOT NULL AND NOT (v_order_status = ANY(v_terminal_states)) THEN
      RAISE EXCEPTION
        'Pedido de Venda não pode ser cancelado enquanto o pedido original estiver ativo (status atual: %). Cancele o pedido original primeiro.',
        v_order_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pv_cancellation ON public.fiscal_invoices;
CREATE TRIGGER trg_guard_pv_cancellation
BEFORE INSERT OR UPDATE OF pedido_status, cancelled_at
ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.guard_pv_cancellation_mirrors_order();

COMMENT ON FUNCTION public.guard_pv_cancellation_mirrors_order() IS
'Impede que um Pedido de Venda (fiscal_invoices.source_order_invoice_id IS NULL) seja marcado como cancelado enquanto o pedido original (orders) ainda estiver em estado ativo. NFs filhas não são afetadas.';