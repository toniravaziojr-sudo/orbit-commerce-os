-- =====================================================
-- Novo status "NF criada" + sincronização PV<->NF para PVs sem pedido original
-- + recálculo no DELETE de NF + reconciliação retroativa.
-- =====================================================

-- 1) Overload da derive_pv_pedido_status com flag de "NF ativa não autorizada"
CREATE OR REPLACE FUNCTION public.derive_pv_pedido_status(
  p_order_status text,
  p_payment_status text,
  p_chargeback_detected_at timestamptz,
  p_cancelled_at timestamptz,
  p_has_authorized_nf boolean,
  p_has_active_nf boolean
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_order_status = 'chargeback_lost' THEN 'chargeback_perdido'
    WHEN p_order_status IN (
           'cancelled','cancelled_by_user','payment_expired',
           'returning','returned','invoice_cancelled'
         )
      OR p_payment_status IN ('cancelled','refunded')
      OR p_cancelled_at IS NOT NULL
      THEN 'cancelado'
    WHEN p_order_status = 'chargeback_detected'
      OR (p_chargeback_detected_at IS NOT NULL
          AND p_order_status NOT IN ('chargeback_recovered','chargeback_lost'))
      THEN 'chargeback_em_andamento'
    WHEN p_has_authorized_nf THEN 'concluido'
    WHEN p_has_active_nf THEN 'nf_criada'
    WHEN p_order_status IS NULL
      OR p_order_status IN (
           'paid','ready_to_invoice','processing',
           'invoice_pending_sefaz','invoice_rejected',
           'invoice_authorized','invoice_issued',
           'dispatched','shipped','in_transit',
           'delivered','completed','fulfilled',
           'chargeback_recovered'
         )
      OR p_payment_status IN ('approved','paid')
      THEN 'em_aberto'
    ELSE 'pendente'
  END;
$$;

-- 2) Função utilitária: recalcula pedido_status de UM PV pelo id (cobre PVs manuais sem order_id)
CREATE OR REPLACE FUNCTION public.recompute_pv_pedido_status(p_pv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pv RECORD;
  v_order_status text;
  v_payment_status text;
  v_chargeback_at timestamptz;
  v_order_cancelled_at timestamptz;
  v_has_authorized boolean;
  v_has_active boolean;
  v_new_status text;
BEGIN
  SELECT id, order_id, source_order_invoice_id, cancelled_at, pedido_status
    INTO v_pv
    FROM public.fiscal_invoices
   WHERE id = p_pv_id;
  IF NOT FOUND OR v_pv.source_order_invoice_id IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_pv.order_id IS NOT NULL THEN
    SELECT status::text, payment_status::text, chargeback_detected_at, cancelled_at
      INTO v_order_status, v_payment_status, v_chargeback_at, v_order_cancelled_at
      FROM public.orders
     WHERE id = v_pv.order_id;
  END IF;

  SELECT
    bool_or(nf.status = 'authorized'),
    bool_or(nf.status IN ('draft','ready','pending','rejected'))
  INTO v_has_authorized, v_has_active
  FROM public.fiscal_invoices nf
  WHERE nf.source_order_invoice_id = v_pv.id;

  v_has_authorized := COALESCE(v_has_authorized, false);
  v_has_active := COALESCE(v_has_active, false);

  v_new_status := public.derive_pv_pedido_status(
    v_order_status, v_payment_status, v_chargeback_at,
    COALESCE(v_order_cancelled_at, v_pv.cancelled_at),
    v_has_authorized, v_has_active
  );

  UPDATE public.fiscal_invoices
     SET pedido_status = v_new_status,
         updated_at = now()
   WHERE id = v_pv.id
     AND pedido_status IS DISTINCT FROM v_new_status;
END;
$$;

-- 3) sync_pedido_status_for_order agora considera NFs ativas (não-autorizadas)
CREATE OR REPLACE FUNCTION public.sync_pedido_status_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
                      AND nf.status = 'authorized'),
           EXISTS (SELECT 1 FROM public.fiscal_invoices nf
                    WHERE nf.source_order_invoice_id = pv.id
                      AND nf.status IN ('draft','ready','pending','rejected'))
         ),
         updated_at = now()
   WHERE pv.order_id = p_order_id
     AND pv.source_order_invoice_id IS NULL;
END;
$$;

-- 4) Trigger NF -> PV: cobre PVs sem order_id (manuais/duplicados) e DELETE
CREATE OR REPLACE FUNCTION public.trg_nf_sync_pv_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pv_id uuid;
  v_pv_order_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.source_order_invoice_id IS NOT NULL THEN
      SELECT id, order_id INTO v_pv_id, v_pv_order_id
        FROM public.fiscal_invoices WHERE id = OLD.source_order_invoice_id;
      IF v_pv_id IS NOT NULL THEN
        IF v_pv_order_id IS NOT NULL THEN
          PERFORM public.sync_pedido_status_for_order(v_pv_order_id);
        ELSE
          PERFORM public.recompute_pv_pedido_status(v_pv_id);
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE
  IF NEW.source_order_invoice_id IS NULL THEN
    -- É um PV (raiz). Mantém comportamento atual.
    IF NEW.pedido_status IS NULL AND NEW.order_id IS NOT NULL THEN
      PERFORM public.sync_pedido_status_for_order(NEW.order_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id, order_id INTO v_pv_id, v_pv_order_id
      FROM public.fiscal_invoices WHERE id = NEW.source_order_invoice_id;
    IF v_pv_id IS NOT NULL THEN
      IF v_pv_order_id IS NOT NULL THEN
        PERFORM public.sync_pedido_status_for_order(v_pv_order_id);
      ELSE
        PERFORM public.recompute_pv_pedido_status(v_pv_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Recria o trigger incluindo DELETE
DROP TRIGGER IF EXISTS fiscal_invoices_sync_pv_status ON public.fiscal_invoices;
CREATE TRIGGER fiscal_invoices_sync_pv_status
AFTER INSERT OR UPDATE OR DELETE ON public.fiscal_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_nf_sync_pv_status();

-- 6) Reconciliação retroativa: recalcula todos os PVs que têm pelo menos uma NF filha
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT pv.id
      FROM public.fiscal_invoices pv
     WHERE pv.source_order_invoice_id IS NULL
       AND EXISTS (
         SELECT 1 FROM public.fiscal_invoices nf
          WHERE nf.source_order_invoice_id = pv.id
       )
  LOOP
    PERFORM public.recompute_pv_pedido_status(r.id);
  END LOOP;
END $$;
