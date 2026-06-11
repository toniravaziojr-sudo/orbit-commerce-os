
CREATE OR REPLACE FUNCTION public.guard_order_cancellation_requires_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text := NEW.status::text;
  v_old_status text := COALESCE(OLD.status::text, '');
BEGIN
  -- Só age em transições PARA estados de cancelamento
  IF v_new_status IN ('cancelled', 'cancelled_by_user')
     AND v_old_status NOT IN ('cancelled', 'cancelled_by_user') THEN

    IF NEW.cancelled_at IS NULL THEN
      RAISE EXCEPTION 'ORDER_CANCEL_REQUIRES_METADATA: Não é permitido marcar o pedido como cancelado sem informar a data de cancelamento (cancelled_at). Operação bloqueada para preservar rastreabilidade.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.cancellation_reason IS NULL
       OR length(btrim(NEW.cancellation_reason)) = 0 THEN
      RAISE EXCEPTION 'ORDER_CANCEL_REQUIRES_METADATA: Não é permitido marcar o pedido como cancelado sem informar o motivo (cancellation_reason). Operação bloqueada para preservar rastreabilidade.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_cancellation_metadata ON public.orders;
CREATE TRIGGER trg_guard_order_cancellation_metadata
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_order_cancellation_requires_metadata();

COMMENT ON FUNCTION public.guard_order_cancellation_requires_metadata() IS
'Bloqueia mudança de status do pedido para cancelado sem cancelled_at e cancellation_reason preenchidos. Anti-regressão do incidente #607 (10/06/2026): UPDATE direto deixou pedido pago como cancelado sem rastro, disparando cascata fiscal/logística.';
