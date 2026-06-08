-- Correção: padroniza valor do enum delivery_status como 'canceled' (grafia oficial)
-- e instala bloqueio real no banco para exclusão de PV com objeto em trânsito/entregue.

-- 1) Corrige cascade_delete_shipments_on_pv_delete (usava 'cancelled' inválido)
--    e adiciona guarda: bloqueia exclusão se objeto estiver em andamento/entregue.
CREATE OR REPLACE FUNCTION public.cascade_delete_shipments_on_pv_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_siblings INT;
  v_blocking_status text;
BEGIN
  IF OLD.fiscal_stage IS DISTINCT FROM 'pedido_venda'
     OR OLD.source_order_invoice_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- GUARDA: bloqueia exclusão de PV se objeto estiver em andamento ou entregue
  SELECT delivery_status::text INTO v_blocking_status
    FROM public.shipments
   WHERE source_pedido_venda_id = OLD.id
     AND delivery_status::text IN ('posted','in_transit','out_for_delivery','delivered','returned','failed')
   LIMIT 1;

  IF v_blocking_status IS NOT NULL THEN
    RAISE EXCEPTION 'PV_SHIPMENT_IN_PROGRESS: Este Pedido de Venda tem um objeto logistico em andamento ou ja entregue (status: %). Nao e possivel excluir.', v_blocking_status
      USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT id, remessa_id, delivery_status
      FROM public.shipments
     WHERE source_pedido_venda_id = OLD.id
  LOOP
    IF r.remessa_id IS NULL THEN
      DELETE FROM public.shipments WHERE id = r.id;
    ELSE
      SELECT COUNT(*) INTO v_siblings
        FROM public.shipments
       WHERE remessa_id = r.remessa_id
         AND id <> r.id
         AND delivery_status::text <> 'canceled';
      IF v_siblings = 0 THEN
        DELETE FROM public.shipments WHERE id = r.id;
      ELSE
        UPDATE public.shipments
           SET delivery_status = 'canceled'::public.delivery_status,
               action_reason   = 'pv_deleted',
               requires_action = false,
               updated_at      = now()
         WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

-- 2) Remove triggers redundantes (já cobertos pela nova função unificada)
DROP TRIGGER IF EXISTS trg_cleanup_shipment_on_pv_delete ON public.fiscal_invoices;
DROP TRIGGER IF EXISTS trg_cascade_delete_draft_shipment_on_pv_delete ON public.fiscal_invoices;
