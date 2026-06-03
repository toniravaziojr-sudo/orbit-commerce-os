-- ============================================================
-- Cascata PV→Remessa + Trigger de limpeza de remessa órfã
-- (significado de status corrigido no código, sem necessidade de backfill)
-- ============================================================

-- 1) Trigger BEFORE DELETE no Pedido de Venda: apaga objetos "ainda parados"
--    (draft/label_created) e mantém objetos "em movimento".
CREATE OR REPLACE FUNCTION public.cascade_delete_shipments_on_pv_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_shipments INT := 0;
BEGIN
  -- Só age em Pedido de Venda raiz (não em NF derivada)
  IF OLD.fiscal_stage IS DISTINCT FROM 'pedido_venda'
     OR OLD.source_order_invoice_id IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Apaga objetos de postagem ainda parados (rascunho ou só etiqueta gerada)
  -- Objetos com delivery_status em ('posted','in_transit','out_for_delivery',
  -- 'delivered','returned','failed','canceled','unknown') permanecem; a FK
  -- shipments.source_pedido_venda_id (ON DELETE SET NULL) cuida do unlink.
  WITH del AS (
    DELETE FROM public.shipments
    WHERE source_pedido_venda_id = OLD.id
      AND delivery_status IN ('draft', 'label_created')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_shipments FROM del;

  IF v_deleted_shipments > 0 THEN
    RAISE NOTICE 'PV % deletado: % objeto(s) parado(s) removido(s) em cascata',
      OLD.id, v_deleted_shipments;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_shipments_on_pv_delete ON public.fiscal_invoices;
CREATE TRIGGER trg_cascade_delete_shipments_on_pv_delete
BEFORE DELETE ON public.fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_shipments_on_pv_delete();


-- 2) Trigger AFTER DELETE em shipments: se a remessa agrupadora ficou vazia
--    e ainda está em rascunho/emitida, apaga a remessa também.
CREATE OR REPLACE FUNCTION public.cleanup_empty_remessa_after_shipment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INT;
  v_status TEXT;
BEGIN
  IF OLD.remessa_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT status INTO v_status
  FROM public.shipping_remessas
  WHERE id = OLD.remessa_id;

  IF v_status NOT IN ('rascunho', 'emitida') THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.shipments
  WHERE remessa_id = OLD.remessa_id;

  IF v_remaining = 0 THEN
    DELETE FROM public.shipping_remessas WHERE id = OLD.remessa_id;
    RAISE NOTICE 'Remessa % apagada (vazia, status %)', OLD.remessa_id, v_status;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_empty_remessa_after_shipment_delete ON public.shipments;
CREATE TRIGGER trg_cleanup_empty_remessa_after_shipment_delete
AFTER DELETE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_empty_remessa_after_shipment_delete();