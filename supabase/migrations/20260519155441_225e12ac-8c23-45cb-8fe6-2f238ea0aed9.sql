
-- 1) Coluna
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS pedido_status text;

COMMENT ON COLUMN public.fiscal_invoices.pedido_status IS
  'Status do pedido refletido no PV. Valores: em_aberto, pendente, concluido, chargeback_em_andamento, chargeback_perdido, cancelado.';

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_pedido_status
  ON public.fiscal_invoices (tenant_id, pedido_status)
  WHERE source_order_invoice_id IS NULL;

-- 2) Função de derivação
CREATE OR REPLACE FUNCTION public.derive_pv_pedido_status(
  p_order_status text,
  p_payment_status text,
  p_chargeback_detected_at timestamptz,
  p_cancelled_at timestamptz,
  p_has_authorized_nf boolean
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_order_status = 'chargeback_lost' THEN 'chargeback_perdido'
    WHEN p_order_status IN ('cancelled','payment_expired')
      OR p_payment_status IN ('cancelled','refunded')
      OR p_cancelled_at IS NOT NULL
      THEN 'cancelado'
    WHEN p_chargeback_detected_at IS NOT NULL
      THEN 'chargeback_em_andamento'
    WHEN p_has_authorized_nf THEN 'concluido'
    WHEN p_order_status IN ('paid','ready_to_invoice','processing','shipped','delivered','invoice_authorized')
      OR p_payment_status IN ('approved','paid')
      THEN 'em_aberto'
    ELSE 'pendente'
  END;
$$;

-- 3) Sincronizador por order_id
CREATE OR REPLACE FUNCTION public.sync_pedido_status_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_payment_status text;
  v_chargeback_at timestamptz;
  v_cancelled_at timestamptz;
BEGIN
  SELECT status::text, payment_status::text, chargeback_detected_at, cancelled_at
    INTO v_status, v_payment_status, v_chargeback_at, v_cancelled_at
    FROM public.orders
   WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.fiscal_invoices pv
     SET pedido_status = public.derive_pv_pedido_status(
           v_status, v_payment_status, v_chargeback_at, v_cancelled_at,
           EXISTS (SELECT 1 FROM public.fiscal_invoices nf
                    WHERE nf.source_order_invoice_id = pv.id
                      AND nf.status = 'authorized')
         ),
         updated_at = now()
   WHERE pv.order_id = p_order_id
     AND pv.source_order_invoice_id IS NULL;
END;
$$;

-- 4) Trigger em orders
CREATE OR REPLACE FUNCTION public.trg_orders_sync_pv_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.chargeback_detected_at IS DISTINCT FROM OLD.chargeback_detected_at
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
    PERFORM public.sync_pedido_status_for_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_sync_pv_status ON public.orders;
CREATE TRIGGER orders_sync_pv_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_sync_pv_status();

-- 5) Trigger em fiscal_invoices (NF/PV)
CREATE OR REPLACE FUNCTION public.trg_nf_sync_pv_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pv_order_id uuid;
BEGIN
  IF NEW.source_order_invoice_id IS NULL THEN
    IF NEW.pedido_status IS NULL AND NEW.order_id IS NOT NULL THEN
      PERFORM public.sync_pedido_status_for_order(NEW.order_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT order_id INTO v_pv_order_id
      FROM public.fiscal_invoices
     WHERE id = NEW.source_order_invoice_id;
    IF v_pv_order_id IS NOT NULL THEN
      PERFORM public.sync_pedido_status_for_order(v_pv_order_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fiscal_invoices_sync_pv_status ON public.fiscal_invoices;
CREATE TRIGGER fiscal_invoices_sync_pv_status
  AFTER INSERT OR UPDATE ON public.fiscal_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_nf_sync_pv_status();

-- 6) Backfill
UPDATE public.fiscal_invoices pv
   SET pedido_status = public.derive_pv_pedido_status(
         o.status::text,
         o.payment_status::text,
         o.chargeback_detected_at,
         o.cancelled_at,
         EXISTS (SELECT 1 FROM public.fiscal_invoices nf
                  WHERE nf.source_order_invoice_id = pv.id
                    AND nf.status = 'authorized')
       ),
       updated_at = now()
  FROM public.orders o
 WHERE pv.order_id = o.id
   AND pv.source_order_invoice_id IS NULL;
